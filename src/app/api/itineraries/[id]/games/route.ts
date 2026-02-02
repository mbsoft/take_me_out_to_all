import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { game_id } = await req.json();

  // Get current max sort_order
  const { data: maxOrderData } = await db
    .from("itinerary_games")
    .select("sort_order")
    .eq("itinerary_id", id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const nextOrder = ((maxOrderData?.sort_order as number) ?? -1) + 1;

  const igId = uuid();
  const { error: insertError } = await db
    .from("itinerary_games")
    .insert({ id: igId, itinerary_id: id, game_id, sort_order: nextOrder });

  if (insertError) {
    return NextResponse.json({ error: "Failed to add game" }, { status: 500 });
  }

  await db
    .from("itineraries")
    .update({ 
      updated_at: new Date().toISOString(),
      route_geometry: null, // Clear cached route geometry
    })
    .eq("id", id);

  return NextResponse.json({ id: igId }, { status: 201 });
}
