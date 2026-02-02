import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const { id, gameId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { notes } = body as { notes?: string };

  const { error } = await db
    .from("itinerary_games")
    .update({ notes: notes ?? null })
    .eq("itinerary_id", id)
    .eq("game_id", parseInt(gameId));

  if (error) {
    return NextResponse.json({ error: "Failed to update notes" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const { id, gameId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await db
    .from("itinerary_games")
    .delete()
    .eq("itinerary_id", id)
    .eq("game_id", parseInt(gameId));

  if (error) {
    return NextResponse.json({ error: "Failed to remove game" }, { status: 500 });
  }

  // Clear cached route geometry
  await db
    .from("itineraries")
    .update({ route_geometry: null })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
