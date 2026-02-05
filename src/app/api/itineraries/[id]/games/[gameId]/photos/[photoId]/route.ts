import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; gameId: string; photoId: string }> }
) {
  const { id, photoId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify user owns this itinerary
  const { data: itinerary } = await db
    .from("itineraries")
    .select("id")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();
  if (!itinerary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Look up the photo to get the storage path
  const { data: photo, error: fetchError } = await db
    .from("itinerary_game_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("itinerary_id", id)
    .single();

  if (fetchError || !photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  // Delete from storage
  await db.storage.from("game-photos").remove([photo.storage_path]);

  // Delete DB record
  const { error: deleteError } = await db
    .from("itinerary_game_photos")
    .delete()
    .eq("id", photoId);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete photo" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
