import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: itinerary, error } = await db
    .from("itineraries")
    .select("share_token")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (error || !itinerary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Return existing token if already shared
  if (itinerary.share_token) {
    return NextResponse.json({ share_token: itinerary.share_token });
  }

  // Generate new token
  const token = randomBytes(9).toString("base64url");

  const { error: updateError } = await db
    .from("itineraries")
    .update({ share_token: token })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to generate share link" }, { status: 500 });
  }

  return NextResponse.json({ share_token: token });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await db
    .from("itineraries")
    .update({ share_token: null })
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to revoke share link" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
