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

  // Get already-added games
  const { data: itineraryGames } = await db
    .from("itinerary_games")
    .select("game_id, games(home_team, date_time)")
    .eq("itinerary_id", itineraryId)
    .order("sort_order", { ascending: true });
  
  // Fetch team data for each game
  const added = await Promise.all(
    (itineraryGames || []).map(async (ig: any) => {
      const game = ig.games;
      if (!game) return null;
      
      const { data: team } = await db
        .from("teams")
        .select("lat, lon")
        .eq("abbr", game.home_team)
        .single();
      
      return {
        game_id: ig.game_id,
        home_team: game.home_team,
        date_time: game.date_time,
        lat: team?.lat,
        lon: team?.lon,
      };
    })
  );
  
  const addedFiltered = added.filter(Boolean);

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

  // Score unvisited parks by proximity and find next feasible game
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

    // Find next home game for this team after earliest arrival
    // Also ensure the game is on or after the itinerary's start_date (if no games added yet)
    let minDate = earliestArrival;
    if (addedFiltered.length === 0 && itinerary.start_date) {
      // If no games added yet, ensure we don't suggest games before the start_date
      const startDate = new Date(itinerary.start_date);
      startDate.setHours(0, 0, 0, 0);
      // Use the later of: start_date or earliestArrival (after travel time)
      if (startDate > earliestArrival) {
        minDate = startDate;
      }
    }
    
    const { data: gamesData } = await db
      .from("games")
      .select("*")
      .eq("home_team", team.abbr as string)
      .neq("status", "Canceled")
      .gte("date_time", minDate.toISOString().slice(0, 19))
      .order("date_time", { ascending: true })
      .limit(1);

    if (gamesData && gamesData.length > 0) {
      const gameData = gamesData[0];
      
      // Fetch team data
      const { data: teamData } = await db
        .from("teams")
        .select("stadium_name, city")
        .eq("abbr", gameData.home_team)
        .single();
      
      const game = {
        ...gameData,
        stadium_name: teamData?.stadium_name,
        city: teamData?.city,
      };
      const score = 1 / (dist + 1); // closer = higher score
      suggestions.push({
        game_id: game.game_id as number,
        home_team: game.home_team as string,
        away_team: game.away_team as string,
        date_time: game.date_time as string,
        stadium_name: game.stadium_name as string,
        city: game.city as string,
        distance: Math.round(dist),
        score,
      });
    }
  }

  suggestions.sort((a, b) => b.score - a.score);

  return NextResponse.json({ suggestions: suggestions.slice(0, 5) });
}
