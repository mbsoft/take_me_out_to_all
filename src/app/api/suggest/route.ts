import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { haversine, estimateTravelTime } from "@/lib/haversine";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const itineraryId = req.nextUrl.searchParams.get("itineraryId");
  if (!itineraryId) {
    return NextResponse.json({ error: "itineraryId required" }, { status: 400 });
  }

  // Get itinerary details
  const { data: itinerary, error: itineraryError } = await db
    .from("itineraries")
    .select("*")
    .eq("id", itineraryId)
    .eq("user_id", session.user.id)
    .single();
  
  if (itineraryError || !itinerary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get already-added games (one query)
  const { data: itineraryGames } = await db
    .from("itinerary_games")
    .select("game_id, games(home_team, date_time)")
    .eq("itinerary_id", itineraryId)
    .order("sort_order", { ascending: true });

  const addedHomeTeams = [...new Set((itineraryGames || []).map((ig: any) => ig.games?.home_team).filter(Boolean))] as string[];
  const addedFiltered: Array<{ game_id: number; home_team: string; date_time: string; lat?: number; lon?: number }> = [];

  if (addedHomeTeams.length > 0) {
    const { data: teamsData } = await db.from("teams").select("abbr, lat, lon").in("abbr", addedHomeTeams);
    const teamByAbbr = new Map((teamsData || []).map((t: any) => [t.abbr, t]));
    for (const ig of itineraryGames || []) {
      const raw = (ig as { games?: { home_team: string; date_time: string } | { home_team: string; date_time: string }[] }).games;
      const game = Array.isArray(raw) ? raw[0] : raw;
      if (!game) continue;
      const team = teamByAbbr.get(game.home_team);
      addedFiltered.push({
        game_id: ig.game_id,
        home_team: game.home_team,
        date_time: game.date_time,
        lat: team?.lat,
        lon: team?.lon,
      });
    }
  }

  const visitedParks = new Set(addedFiltered.map((r: any) => r.home_team as string));
  const goalFilter = itinerary.goal === "al" ? "AL" : itinerary.goal === "nl" ? "NL" : null;

  // Get target teams
  let teamsQuery = db.from("teams").select("*");
  if (goalFilter) {
    teamsQuery = teamsQuery.eq("league", goalFilter);
  }
  const { data: allTeams } = await teamsQuery;
  const unvisitedTeams = (allTeams || []).filter((t: any) => !visitedParks.has(t.abbr as string));

  if (unvisitedTeams.length === 0) {
    return NextResponse.json({ suggestions: [], message: "All parks visited!" });
  }

  // Determine last location and starting date
  let lastLat: number, lastLon: number;
  let lastDate: string;
  if (addedFiltered.length > 0) {
    // Use the last added game's location and date
    const last = addedFiltered[addedFiltered.length - 1]!;
    lastLat = last!.lat as number;
    lastLon = last!.lon as number;
    lastDate = last!.date_time as string;
  } else {
    // No games added yet - use itinerary's start location and start_date
    lastLat = (itinerary.start_lat as number) || 39.8283;
    lastLon = (itinerary.start_lon as number) || -98.5795;
    
    // Use the itinerary's start_date if available, otherwise default to season start
    if (itinerary.start_date) {
      // Convert DATE to ISO string format (YYYY-MM-DD -> YYYY-MM-DDTHH:MM:SS)
      const startDate = new Date(itinerary.start_date);
      startDate.setHours(0, 0, 0, 0);
      lastDate = startDate.toISOString();
    } else {
      lastDate = "2026-03-25T00:00:00";
    }
  }

  // Global floor for game dates (schedule is already in DB)
  const globalMinDate = addedFiltered.length === 0 && itinerary.start_date
    ? new Date(itinerary.start_date).toISOString().slice(0, 19)
    : lastDate.slice(0, 19);

  // Single query: all upcoming games at unvisited parks (schedule in DB)
  const unvisitedAbbrs = unvisitedTeams.map((t: any) => t.abbr);
  const { data: upcomingGames } = await db
    .from("games")
    .select("*")
    .in("home_team", unvisitedAbbrs)
    .neq("status", "Canceled")
    .gte("date_time", globalMinDate)
    .order("date_time", { ascending: true });

  const teamByAbbr = new Map((allTeams || []).map((t: any) => [t.abbr, t]));

  // Group upcoming games by home_team (schedule already in DB, one query)
  const gamesByTeam = new Map<string, (typeof upcomingGames)>();
  for (const g of upcomingGames || []) {
    const abbr = g.home_team as string;
    if (!gamesByTeam.has(abbr)) gamesByTeam.set(abbr, []);
    gamesByTeam.get(abbr)!.push(g);
  }

  const travelMode = itinerary.travel_mode as "drive" | "fly" | "mixed";
  const suggestions: Array<{
    game_id: number;
    home_team: string;
    away_team: string;
    date_time: string;
    stadium_name: string;
    city: string;
    distance: number;
    score: number;
  }> = [];

  for (const team of unvisitedTeams) {
    const dist = haversine(lastLat, lastLon, team.lat as number, team.lon as number);
    const travelHours = estimateTravelTime(dist, travelMode);
    const earliestArrival = new Date(new Date(lastDate).getTime() + travelHours * 3600_000);
    let minDate = earliestArrival;
    if (addedFiltered.length === 0 && itinerary.start_date) {
      const startDate = new Date(itinerary.start_date);
      startDate.setHours(0, 0, 0, 0);
      if (startDate > earliestArrival) minDate = startDate;
    }

    const teamGames = gamesByTeam.get(team.abbr as string);
    if (!teamGames?.length) continue;
    const gameData = teamGames.find((g) => new Date(g.date_time as string) >= minDate);
    if (!gameData) continue;

    const teamData = teamByAbbr.get(team.abbr as string);
    const stadium_name = (teamData?.stadium_name as string) ?? "";
    const city = (teamData?.city as string) ?? "";
    const score = 1 / (dist + 1);
    suggestions.push({
      game_id: gameData.game_id as number,
      home_team: gameData.home_team as string,
      away_team: gameData.away_team as string,
      date_time: gameData.date_time as string,
      stadium_name,
      city,
      distance: Math.round(dist),
      score,
    });
  }

  suggestions.sort((a, b) => b.score - a.score);

  return NextResponse.json({ suggestions: suggestions.slice(0, 5) });
}
