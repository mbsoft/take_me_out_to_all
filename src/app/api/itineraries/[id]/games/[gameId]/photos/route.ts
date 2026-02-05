import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const { id, gameId } = await params;
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

  const { data: photos, error } = await db
    .from("itinerary_game_photos")
    .select("*")
    .eq("itinerary_id", id)
    .eq("game_id", parseInt(gameId))
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch photos" }, { status: 500 });
  }

  const result = (photos ?? []).map((p: any) => {
    const { data } = db.storage.from("game-photos").getPublicUrl(p.storage_path);
    return {
      id: p.id,
      file_name: p.file_name,
      url: data.publicUrl,
      created_at: p.created_at,
    };
  });

  return NextResponse.json({ photos: result });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const { id, gameId } = await params;
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

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed. Use JPEG, PNG, WebP, or GIF." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum 5 MB." }, { status: 400 });
  }

  const photoId = crypto.randomUUID();
  const ext = file.name.split(".").pop() || "jpg";
  const storagePath = `${session.user.id}/${id}/${gameId}/${photoId}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await db.storage
    .from("game-photos")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }

  const { error: dbError } = await db
    .from("itinerary_game_photos")
    .insert({
      id: photoId,
      itinerary_id: id,
      game_id: parseInt(gameId),
      storage_path: storagePath,
      file_name: file.name,
    });

  if (dbError) {
    // Clean up uploaded file
    await db.storage.from("game-photos").remove([storagePath]);
    console.error("DB insert error:", dbError);
    return NextResponse.json({ error: "Failed to save photo record" }, { status: 500 });
  }

  const { data: urlData } = db.storage.from("game-photos").getPublicUrl(storagePath);

  return NextResponse.json({
    photo: {
      id: photoId,
      file_name: file.name,
      url: urlData.publicUrl,
      created_at: new Date().toISOString(),
    },
  });
}
