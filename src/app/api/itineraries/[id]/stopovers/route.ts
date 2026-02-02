import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: itineraryId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { after_index, label, lat, lon } = body as {
    after_index: number;
    label: string;
    lat: number;
    lon: number;
  };
  if (
    typeof after_index !== "number" ||
    !label ||
    typeof lat !== "number" ||
    typeof lon !== "number"
  ) {
    return NextResponse.json(
      { error: "after_index, label, lat, lon required" },
      { status: 400 }
    );
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

  const { data: maxOrder } = await db
    .from("itinerary_stopovers")
    .select("sort_order")
    .eq("itinerary_id", itineraryId)
    .eq("after_index", after_index)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const sort_order = (maxOrder?.sort_order ?? -1) + 1;

  const stopoverId = uuid();
  const { error: insertError } = await db.from("itinerary_stopovers").insert({
    id: stopoverId,
    itinerary_id: itineraryId,
    after_index,
    label,
    lat,
    lon,
    sort_order,
  });
  if (insertError) {
    return NextResponse.json(
      { error: "Failed to add stopover", details: insertError.message },
      { status: 500 }
    );
  }

  await db
    .from("itineraries")
    .update({ route_geometry: null, updated_at: new Date().toISOString() })
    .eq("id", itineraryId)
    .eq("user_id", session.user.id);

  return NextResponse.json({
    id: stopoverId,
    itinerary_id: itineraryId,
    after_index,
    label,
    lat,
    lon,
    sort_order,
  });
}
