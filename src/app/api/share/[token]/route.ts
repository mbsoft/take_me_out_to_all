import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseCustomTeams } from "@/lib/goal-utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const { data: itinerary, error: itError } = await db
    .from("itineraries")
    .select("*")
    .eq("share_token", token)
    .single();

  if (itError || !itinerary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: itineraryGames } = await db
    .from("itinerary_games")
    .select("*, games(*)")
    .eq("itinerary_id", itinerary.id)
    .order("sort_order", { ascending: true });

  const { data: stopovers } = await db
    .from("itinerary_stopovers")
    .select("*")
    .eq("itinerary_id", itinerary.id)
    .order("after_index", { ascending: true })
    .order("sort_order", { ascending: true });

  const transformedGames = await Promise.all(
    (itineraryGames || []).map(async (ig: any) => {
      const game = ig.games;
      if (!game) return ig;

      const [homeTeam, awayTeam] = await Promise.all([
        db.from("teams").select("*").eq("abbr", game.home_team).single(),
        db.from("teams").select("*").eq("abbr", game.away_team).single(),
      ]);

      return {
        game_id: ig.game_id,
        sort_order: ig.sort_order,
        locked: ig.locked,
        day: game.day,
        date_time: game.date_time,
        away_team: game.away_team,
        home_team: game.home_team,
        stadium_name: homeTeam.data?.stadium_name,
        city: homeTeam.data?.city,
        state: homeTeam.data?.state,
        lat: homeTeam.data?.lat,
        lon: homeTeam.data?.lon,
        home_team_name: homeTeam.data?.name,
        away_team_name: awayTeam.data?.name,
      };
    }),
  );

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

  const custom_teams = parseCustomTeams(itinerary.custom_teams);

  return NextResponse.json({
    name: itinerary.name,
    goal: itinerary.goal,
    travel_mode: itinerary.travel_mode,
    start_date: itinerary.start_date,
    start_location: itinerary.start_location,
    start_lat: itinerary.start_lat,
    start_lon: itinerary.start_lon,
    end_location: itinerary.end_location,
    end_lat: itinerary.end_lat,
    end_lon: itinerary.end_lon,
    games: transformedGames,
    stopovers: stopovers ?? [],
    segment_modes,
    custom_teams: custom_teams.length > 0 ? custom_teams : null,
  });
}
