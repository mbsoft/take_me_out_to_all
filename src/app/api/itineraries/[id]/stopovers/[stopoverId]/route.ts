import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; stopoverId: string }> }
) {
  const { id: itineraryId, stopoverId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: itinerary } = await db
    .from("itineraries")
    .select("id")
    .eq("id", itineraryId)
    .eq("user_id", session.user.id)
    .single();
  if (!itinerary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await db
    .from("itinerary_stopovers")
    .delete()
    .eq("id", stopoverId)
    .eq("itinerary_id", itineraryId);
  if (error) {
    return NextResponse.json(
      { error: "Failed to delete stopover", details: error.message },
      { status: 500 }
    );
  }

  await db
    .from("itineraries")
    .update({ route_geometry: null, updated_at: new Date().toISOString() })
    .eq("id", itineraryId)
    .eq("user_id", session.user.id);

  return NextResponse.json({ ok: true });
}
