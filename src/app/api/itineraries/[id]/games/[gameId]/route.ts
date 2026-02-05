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
  const { notes, locked } = body as { notes?: string; locked?: boolean };

  const update: Record<string, unknown> = {};
  if (notes !== undefined) update.notes = notes ?? null;
  if (locked !== undefined) update.locked = locked;

  const { error } = await db
    .from("itinerary_games")
    .update(update)
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

  // Check if game is locked
  const { data: ig } = await db
    .from("itinerary_games")
    .select("locked")
    .eq("itinerary_id", id)
    .eq("game_id", parseInt(gameId))
    .single();

  if (ig?.locked) {
    return NextResponse.json({ error: "Cannot remove a locked game" }, { status: 400 });
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
