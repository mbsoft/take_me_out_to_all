import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { userId } = await params;

  const { data: itineraries, error } = await db
    .from("itineraries")
    .select("id, name, goal, travel_mode, start_location, end_location, start_date, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    game_count: countMap.get(it.id) || 0,
  }));

  return NextResponse.json({ itineraries: mapped });
}
