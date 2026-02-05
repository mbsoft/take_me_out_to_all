import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const offset = (page - 1) * limit;

  let query = db
    .from("itinerary_templates")
    .select("*", { count: "exact" });

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data: templates, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get creator emails
  const creatorIds = [...new Set((templates || []).map((t: any) => t.created_by))];
  const { data: users } = await db
    .from("users")
    .select("id, email")
    .in("id", creatorIds);

  const userMap = new Map<string, string>();
  for (const u of users || []) {
    userMap.set(u.id, u.email);
  }

  // Get game counts per template
  const templateIds = (templates || []).map((t: any) => t.id);
  const { data: gameCounts } = await db
    .from("itinerary_template_games")
    .select("template_id")
    .in("template_id", templateIds);

  const countMap = new Map<string, number>();
  for (const row of gameCounts || []) {
    countMap.set(row.template_id, (countMap.get(row.template_id) || 0) + 1);
  }

  const mapped = (templates || []).map((t: any) => ({
    ...t,
    creator_email: userMap.get(t.created_by) || "unknown",
    game_count: countMap.get(t.id) || 0,
  }));

  return NextResponse.json({
    templates: mapped,
    total: count ?? 0,
    page,
    limit,
  });
}

export async function POST(req: Request) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { source_itinerary_id, name, description } = await req.json();

  if (!source_itinerary_id || !name) {
    return NextResponse.json({ error: "source_itinerary_id and name are required" }, { status: 400 });
  }

  // Fetch source itinerary (admin can read any)
  const { data: itinerary, error: itErr } = await db
    .from("itineraries")
    .select("*")
    .eq("id", source_itinerary_id)
    .single();

  if (itErr || !itinerary) {
    return NextResponse.json({ error: "Source itinerary not found" }, { status: 404 });
  }

  // Fetch source games with game details
  const { data: games } = await db
    .from("itinerary_games")
    .select("*, games(home_team, away_team)")
    .eq("itinerary_id", source_itinerary_id)
    .order("sort_order", { ascending: true });

  // Fetch source stopovers
  const { data: stopovers } = await db
    .from("itinerary_stopovers")
    .select("*")
    .eq("itinerary_id", source_itinerary_id);

  // Create template
  const templateId = uuid();
  const { error: createErr } = await db.from("itinerary_templates").insert({
    id: templateId,
    name,
    description: description || null,
    goal: itinerary.goal,
    travel_mode: itinerary.travel_mode,
    start_location: itinerary.start_location,
    start_lat: itinerary.start_lat,
    start_lon: itinerary.start_lon,
    end_location: itinerary.end_location,
    end_lat: itinerary.end_lat,
    end_lon: itinerary.end_lon,
    custom_teams: itinerary.custom_teams,
    segment_modes: itinerary.segment_modes,
    source_itinerary_id,
    created_by: check.userId,
  });

  if (createErr) {
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }

  // Copy games
  if (games && games.length > 0) {
    const gameInserts = games.map((g: any) => ({
      id: uuid(),
      template_id: templateId,
      home_team: g.games?.home_team || g.home_team,
      away_team: g.games?.away_team || g.away_team,
      game_id: g.game_id,
      sort_order: g.sort_order,
      notes: g.notes || null,
    }));

    await db.from("itinerary_template_games").insert(gameInserts);
  }

  // Copy stopovers
  if (stopovers && stopovers.length > 0) {
    const stopoverInserts = stopovers.map((s: any) => ({
      id: uuid(),
      template_id: templateId,
      after_index: s.after_index,
      label: s.label,
      lat: s.lat,
      lon: s.lon,
      sort_order: s.sort_order,
    }));

    await db.from("itinerary_template_stopovers").insert(stopoverInserts);
  }

  await logAdminAction(check.userId, "create_template", "template", templateId, {
    source_itinerary_id,
    name,
  });

  return NextResponse.json({ id: templateId }, { status: 201 });
}
