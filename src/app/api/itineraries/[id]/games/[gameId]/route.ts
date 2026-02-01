import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

  return NextResponse.json({ ok: true });
}
