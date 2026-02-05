import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { haversine, estimateTravelTime } from "@/lib/haversine";
import { parseCustomTeams } from "@/lib/goal-utils";

/**
 * Intelligent game suggestion algorithm
 *
 * Key features:
 * 1. First game immutability: If itinerary has games, suggestions never come before first game
 * 2. Date-aware scoring: Heavily biases suggestions towards games after the last game
 * 3. Combined scoring: 60% based on proximity, 40% based on date proximity
 * 4. Optimal timing: Prefers games 1-7 days after last game, penalizes games >14 days out
 * 5. Unvisited parks only: Only suggests games at ballparks not yet in itinerary
 */
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

  // Get target teams
  let teamsQuery = db.from("teams").select("*");
  if (itinerary.goal === "al") {
    teamsQuery = teamsQuery.eq("league", "AL");
  } else if (itinerary.goal === "nl") {
    teamsQuery = teamsQuery.eq("league", "NL");
  } else if (itinerary.goal === "custom") {
    const customTeams = parseCustomTeams(itinerary.custom_teams);
    if (customTeams.length > 0) {
      teamsQuery = teamsQuery.in("abbr", customTeams);
    }
  }
  const { data: allTeams } = await teamsQuery;
  const unvisitedTeams = (allTeams || []).filter((t: any) => !visitedParks.has(t.abbr as string));

  if (unvisitedTeams.length === 0) {
    return NextResponse.json({ suggestions: [], message: "All parks visited!" });
  }

  // Determine last location and starting date
  let lastLat: number, lastLon: number;
  let lastDate: string;
  let firstGameDate: string | null = null;

  if (addedFiltered.length > 0) {
    // Use the last added game's location and date
    const last = addedFiltered[addedFiltered.length - 1]!;
    lastLat = last!.lat as number;
    lastLon = last!.lon as number;
    lastDate = last!.date_time as string;

    // IMPORTANT: First game in itinerary is immutable - don't suggest anything before it
    const first = addedFiltered[0]!;
    firstGameDate = first!.date_time as string;
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

  // Global floor for game dates - use first game date if itinerary has games, otherwise use start date
  const globalMinDate = firstGameDate
    ? firstGameDate.slice(0, 19) // First game is immutable
    : (addedFiltered.length === 0 && itinerary.start_date
        ? new Date(itinerary.start_date).toISOString().slice(0, 19)
        : lastDate.slice(0, 19));

  // Single query: all upcoming games at unvisited parks (schedule in DB)
  // If itinerary has games, only suggest games after the first game (first game is immutable)
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
    date_score: number;
    distance_score: number;
  }> = [];

  // Calculate last game date in milliseconds for date scoring
  const lastGameMs = new Date(lastDate).getTime();
  const DAY_MS = 24 * 3600_000;

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

    // Find all feasible games and score them by date proximity
    const feasibleGames = teamGames.filter((g) => new Date(g.date_time as string) >= minDate);
    if (feasibleGames.length === 0) continue;

    // Prefer games closer to the last game date (within reasonable window)
    // Score based on: how soon after the last game, but not too far in future
    let bestGame = feasibleGames[0];
    let bestDateScore = -Infinity;

    for (const game of feasibleGames.slice(0, 10)) { // Check first 10 games only for performance
      const gameMs = new Date(game.date_time as string).getTime();
      const daysDiff = (gameMs - lastGameMs) / DAY_MS;

      // Ideal range: 1-7 days after last game
      // Scoring: penalize games too close (<1 day for travel) or too far (>14 days)
      let dateScore: number;
      if (daysDiff < 0.5) {
        dateScore = 0; // Too soon, no time to travel
      } else if (daysDiff <= 3) {
        dateScore = 1.0; // Optimal: 1-3 days
      } else if (daysDiff <= 7) {
        dateScore = 0.8; // Good: 4-7 days
      } else if (daysDiff <= 14) {
        dateScore = 0.5; // Acceptable: 8-14 days
      } else if (daysDiff <= 30) {
        dateScore = 0.3; // Far future: 15-30 days
      } else {
        dateScore = 0.1; // Very far future: >30 days
      }

      if (dateScore > bestDateScore) {
        bestDateScore = dateScore;
        bestGame = game;
      }
    }

    const gameData = bestGame;
    const teamData = teamByAbbr.get(team.abbr as string);
    const stadium_name = (teamData?.stadium_name as string) ?? "";
    const city = (teamData?.city as string) ?? "";

    // Combined scoring: 60% distance, 40% date proximity
    const distanceScore = 1 / (dist + 100); // Normalize distance score
    const dateScore = bestDateScore;
    const combinedScore = (distanceScore * 0.6) + (dateScore * 0.4);

    suggestions.push({
      game_id: gameData.game_id as number,
      home_team: gameData.home_team as string,
      away_team: gameData.away_team as string,
      date_time: gameData.date_time as string,
      stadium_name,
      city,
      distance: Math.round(dist),
      score: combinedScore,
      date_score: dateScore,
      distance_score: distanceScore,
    });
  }

  suggestions.sort((a, b) => b.score - a.score);

  return NextResponse.json({ suggestions: suggestions.slice(0, 5) });
}
