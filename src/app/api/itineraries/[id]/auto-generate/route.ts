import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { optimizeRoute, type Park, type ScheduledGame } from "@/lib/route-optimizer";
import { optimizeRouteWithNB, type LockedGame } from "@/lib/nb-route-optimizer";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse optional date overrides from request body
  let bodyStartDate: string | undefined;
  let bodyEndDate: string | undefined;
  let bodyDescription: string | undefined;
  try {
    const body = await req.json();
    bodyStartDate = body.start_date;
    bodyEndDate = body.end_date;
    bodyDescription = body.description;
  } catch {
    // No body or invalid JSON — that's fine, use itinerary's start_date
  }

  // Fetch itinerary and verify ownership
  const { data: itinerary, error: itError } = await db
    .from("itineraries")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (itError || !itinerary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Use the date picker value if provided, otherwise fall back to itinerary's start_date
  const effectiveStartDate = bodyStartDate || itinerary.start_date;

  if (!effectiveStartDate || !itinerary.start_lat || !itinerary.start_lon) {
    return NextResponse.json(
      { error: "Start date and start location are required for auto-generate" },
      { status: 400 }
    );
  }

  // Fetch target teams
  let teamsQuery = db.from("teams").select("*");
  if (itinerary.goal === "al") teamsQuery = teamsQuery.eq("league", "AL");
  if (itinerary.goal === "nl") teamsQuery = teamsQuery.eq("league", "NL");
  const { data: teams } = await teamsQuery;

  if (!teams || teams.length === 0) {
    return NextResponse.json({ error: "No target teams found" }, { status: 422 });
  }

  const parks: Park[] = teams.map((t: any) => ({
    abbr: t.abbr as string,
    lat: t.lat as number,
    lon: t.lon as number,
    stadium_name: t.stadium_name as string,
  }));

  // Prefetch candidate home games bounded by date pickers
  const targetAbbrs = parks.map((p) => p.abbr);
  const startDateIso = new Date(effectiveStartDate as string).toISOString();

  let gamesQuery = db
    .from("games")
    .select("*")
    .in("home_team", targetAbbrs)
    .neq("status", "Canceled")
    .gte("date_time", startDateIso)
    .order("date_time", { ascending: true });

  if (bodyEndDate) {
    // Add one day to end date so games on the end date itself are included
    const endDateObj = new Date(bodyEndDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    gamesQuery = gamesQuery.lte("date_time", endDateObj.toISOString());
  }

  const { data: allGames } = await gamesQuery;

  if (!allGames || allGames.length === 0) {
    return NextResponse.json(
      { error: "No games found in the schedule after the start date" },
      { status: 422 }
    );
  }

  console.log(`[Auto-generate] Found ${allGames.length} candidate games from ${effectiveStartDate}${bodyEndDate ? ` to ${bodyEndDate}` : ""}`);

  // Group games by home team
  const gamesByPark = new Map<string, ScheduledGame[]>();
  for (const g of allGames) {
    const abbr = g.home_team as string;
    if (!gamesByPark.has(abbr)) gamesByPark.set(abbr, []);
    gamesByPark.get(abbr)!.push({
      game_id: g.game_id as number,
      home_team: g.home_team as string,
      away_team: g.away_team as string,
      date_time: g.date_time as string,
      date_time_utc: g.date_time_utc as string,
      day: g.day as string,
    });
  }

  // Log per-team game counts to diagnose infeasible parks
  const teamsWithNoGames = targetAbbrs.filter((a) => !gamesByPark.has(a));
  if (teamsWithNoGames.length > 0) {
    console.warn(`[Auto-generate] Teams with NO home games in window: ${teamsWithNoGames.join(", ")}`);
  }
  console.log(`[Auto-generate] Games per team: ${targetAbbrs.map((a) => `${a}:${gamesByPark.get(a)?.length ?? 0}`).join(", ")}`);

  // Fetch locked games for this itinerary
  const { data: lockedRows } = await db
    .from("itinerary_games")
    .select("game_id, games(home_team, date_time)")
    .eq("itinerary_id", id)
    .eq("locked", true);

  const lockedGames: LockedGame[] = (lockedRows ?? [])
    .filter((r: any) => r.games)
    .map((r: any) => ({
      abbr: r.games.home_team as string,
      game_id: r.game_id as number,
      date_time: r.games.date_time as string,
    }));

  const lockedGameIds = new Set(lockedGames.map((lg) => lg.game_id));

  if (lockedGames.length > 0) {
    console.log(`[Auto-generate] ${lockedGames.length} locked game(s): ${lockedGames.map((lg) => `${lg.abbr}:${lg.game_id}`).join(", ")}`);
  }

  // Run optimizer
  const startLocation = {
    lat: itinerary.start_lat as number,
    lon: itinerary.start_lon as number,
  };
  const endLocation =
    itinerary.end_lat && itinerary.end_lon
      ? { lat: itinerary.end_lat as number, lon: itinerary.end_lon as number }
      : null;

  let result;
  try {
    console.log("[Auto-generate] Using NB.ai Route Optimization API v2");
    result = await optimizeRouteWithNB(
      startLocation,
      endLocation,
      effectiveStartDate as string,
      bodyEndDate || null,
      parks,
      gamesByPark,
      bodyDescription,
      lockedGames.length > 0 ? lockedGames : undefined,
    );
  } catch (nbError) {
    console.warn("[Auto-generate] NB.ai optimization failed, falling back to local optimizer:", nbError);
    result = optimizeRoute(
      startLocation,
      endLocation,
      effectiveStartDate as string,
      parks,
      gamesByPark
    );
  }

  if (result.stops.length === 0) {
    return NextResponse.json(
      { error: "Could not schedule any games. Try an earlier start date." },
      { status: 422 }
    );
  }

  // Clear unlocked games and stopovers (preserve locked games)
  if (lockedGameIds.size > 0) {
    await db
      .from("itinerary_games")
      .delete()
      .eq("itinerary_id", id)
      .not("locked", "eq", true);
  } else {
    await db.from("itinerary_games").delete().eq("itinerary_id", id);
  }
  await db.from("itinerary_stopovers").delete().eq("itinerary_id", id);

  // Insert new (non-locked) games from optimizer result and update sort_order for locked ones
  const inserts: { id: string; itinerary_id: string; game_id: number; sort_order: number }[] = [];
  const lockedUpdates: { game_id: number; sort_order: number }[] = [];

  result.stops.forEach((stop, index) => {
    if (lockedGameIds.has(stop.game.game_id)) {
      lockedUpdates.push({ game_id: stop.game.game_id, sort_order: index });
    } else {
      inserts.push({
        id: uuid(),
        itinerary_id: id,
        game_id: stop.game.game_id,
        sort_order: index,
      });
    }
  });

  if (inserts.length > 0) {
    const { error: insertError } = await db.from("itinerary_games").insert(inserts);
    if (insertError) {
      console.error("Auto-generate insert error:", insertError);
      return NextResponse.json({ error: "Failed to save generated itinerary" }, { status: 500 });
    }
  }

  // Update sort_order for locked games to match optimizer's route order
  for (const lu of lockedUpdates) {
    await db
      .from("itinerary_games")
      .update({ sort_order: lu.sort_order })
      .eq("itinerary_id", id)
      .eq("game_id", lu.game_id);
  }

  // Update itinerary metadata
  await db
    .from("itineraries")
    .update({
      segment_modes: result.segmentModes,
      route_geometry: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({
    success: true,
    games_added: result.stops.length,
    total_parks: parks.length,
    parks_covered: result.stops.length,
    infeasible_parks: result.infeasibleParks,
    total_distance_miles: Math.round(result.totalDistanceMiles),
    estimated_days: result.estimatedDays,
    segment_modes: result.segmentModes,
  });
}
