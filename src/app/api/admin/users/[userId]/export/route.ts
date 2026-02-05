import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { userId } = await params;

  // Fetch user
  const { data: user, error: userError } = await db
    .from("users")
    .select("id, email, name, role, is_active, created_at")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch itineraries
  const { data: itineraries } = await db
    .from("itineraries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // Fetch games and stopovers for each itinerary
  const itIds = (itineraries || []).map((it) => it.id);
  const { data: games } = await db
    .from("itinerary_games")
    .select("*")
    .in("itinerary_id", itIds);
  const { data: stopovers } = await db
    .from("itinerary_stopovers")
    .select("*")
    .in("itinerary_id", itIds);

  const exportData = {
    exported_at: new Date().toISOString(),
    user,
    itineraries: (itineraries || []).map((it) => ({
      ...it,
      games: (games || []).filter((g) => g.itinerary_id === it.id),
      stopovers: (stopovers || []).filter((s) => s.itinerary_id === it.id),
    })),
  };

  await logAdminAction(check.userId, "export_user_data", "user", userId);

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="user-${userId}-export.json"`,
    },
  });
}
