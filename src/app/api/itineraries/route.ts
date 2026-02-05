import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseCustomTeams } from "@/lib/goal-utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await db
    .from("itineraries")
    .select(`
      *,
      itinerary_games(id)
    `)
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: "Failed to fetch itineraries" }, { status: 500 });
  }
  
  // Transform data to include game_count and parse custom_teams
  const transformed = (data || []).map((itinerary: any) => ({
    ...itinerary,
    game_count: itinerary.itinerary_games?.length || 0,
    custom_teams: itinerary.custom_teams ? parseCustomTeams(itinerary.custom_teams) : null,
    itinerary_games: undefined, // Remove the nested data
  }));
  
  return NextResponse.json(transformed);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.goal === "custom" && (!Array.isArray(body.custom_teams) || body.custom_teams.length === 0)) {
    return NextResponse.json({ error: "At least one ballpark must be selected for a custom goal" }, { status: 400 });
  }

  const id = uuid();
  const { data, error } = await db
    .from("itineraries")
    .insert({
      id,
      user_id: session.user.id,
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
      custom_teams: body.goal === "custom" ? JSON.stringify(body.custom_teams) : null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating itinerary:", error);
    return NextResponse.json({ error: "Failed to create itinerary", details: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id || id }, { status: 201 });
}
