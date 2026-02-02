import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: itinerary, error: itineraryError } = await db
    .from("itineraries")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();
  
  if (itineraryError || !itinerary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: itineraryGames, error: gamesError } = await db
    .from("itinerary_games")
    .select(`
      *,
      games(*)
    `)
    .eq("itinerary_id", id)
    .order("sort_order", { ascending: true });
  
  if (gamesError) {
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }

  const { data: stopovers } = await db
    .from("itinerary_stopovers")
    .select("*")
    .eq("itinerary_id", id)
    .order("after_index", { ascending: true })
    .order("sort_order", { ascending: true });

  // Fetch team data for each game
  const transformedGames = await Promise.all(
    (itineraryGames || []).map(async (ig: any) => {
      const game = ig.games;
      if (!game) return ig;

      // Fetch home and away team data
      const [homeTeam, awayTeam] = await Promise.all([
        db.from("teams").select("*").eq("abbr", game.home_team).single(),
        db.from("teams").select("*").eq("abbr", game.away_team).single(),
      ]);

      return {
        ...ig,
        day: game.day,
        date_time: game.date_time,
        date_time_utc: game.date_time_utc,
        away_team: game.away_team,
        home_team: game.home_team,
        stadium_id: game.stadium_id,
        status: game.status,
        stadium_name: homeTeam.data?.stadium_name,
        city: homeTeam.data?.city,
        state: homeTeam.data?.state,
        lat: homeTeam.data?.lat,
        lon: homeTeam.data?.lon,
        home_team_name: homeTeam.data?.name,
        away_team_name: awayTeam.data?.name,
      };
    })
  );

  // Order by event date and time
  transformedGames.sort((a: any, b: any) => {
    const at = a.date_time ?? "";
    const bt = b.date_time ?? "";
    return at.localeCompare(bt);
  });

  let segment_modes: string[] = [];
  if (itinerary.segment_modes) {
    try {
      segment_modes = Array.isArray(itinerary.segment_modes)
        ? itinerary.segment_modes
        : JSON.parse(itinerary.segment_modes as string) ?? [];
    } catch {
      segment_modes = [];
    }
  }

  return NextResponse.json({
    ...itinerary,
    games: transformedGames,
    stopovers: stopovers ?? [],
    segment_modes,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const segment_modes_json =
    body.segment_modes != null
      ? JSON.stringify(Array.isArray(body.segment_modes) ? body.segment_modes : [])
      : undefined;
  const update: Record<string, unknown> = {
    name: body.name,
    goal: body.goal,
    travel_mode: body.travel_mode,
    start_date: body.start_date || null,
    start_location: body.start_location || null,
    start_lat: body.start_lat || null,
    start_lon: body.start_lon || null,
    end_location: body.end_location || null,
    end_lat: body.end_lat || null,
    end_lon: body.end_lon || null,
    route_geometry: null,
    updated_at: new Date().toISOString(),
  };
  if (segment_modes_json !== undefined) update.segment_modes = segment_modes_json;
  const { error } = await db
    .from("itineraries")
    .update(update)
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update itinerary" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await db
    .from("itineraries")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete itinerary" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
