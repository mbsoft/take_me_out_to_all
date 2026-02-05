import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
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
    .from("itineraries")
    .select("id, name, goal, travel_mode, start_location, start_date, user_id, created_at, updated_at", { count: "exact" });

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data: itineraries, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get owner emails
  const userIds = [...new Set((itineraries || []).map((it) => it.user_id))];
  const { data: users } = await db
    .from("users")
    .select("id, email, name")
    .in("id", userIds);

  const userMap = new Map<string, { email: string; name: string | null }>();
  for (const u of users || []) {
    userMap.set(u.id, { email: u.email, name: u.name });
  }

  // Get game counts
  const itIds = (itineraries || []).map((it) => it.id);
  const { data: gameCounts } = await db
    .from("itinerary_games")
    .select("itinerary_id")
    .in("itinerary_id", itIds);

  const countMap = new Map<string, number>();
  for (const row of gameCounts || []) {
    countMap.set(row.itinerary_id, (countMap.get(row.itinerary_id) || 0) + 1);
  }

  const mapped = (itineraries || []).map((it) => ({
    ...it,
    owner_email: userMap.get(it.user_id)?.email || "unknown",
    owner_name: userMap.get(it.user_id)?.name || null,
    game_count: countMap.get(it.id) || 0,
  }));

  return NextResponse.json({
    itineraries: mapped,
    total: count ?? 0,
    page,
    limit,
  });
}
