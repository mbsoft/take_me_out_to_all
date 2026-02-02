import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { game_ids } = await req.json() as { game_ids: number[] };

  // Update each game's sort_order
  await Promise.all(
    game_ids.map((gameId, index) =>
      db
        .from("itinerary_games")
        .update({ sort_order: index })
        .eq("itinerary_id", id)
        .eq("game_id", gameId)
    )
  );

  await db
    .from("itineraries")
    .update({ 
      updated_at: new Date().toISOString(),
      route_geometry: null, // Clear cached route geometry
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
