import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { userId } = await params;

  // Get current status
  const { data: user, error: fetchError } = await db
    .from("users")
    .select("is_active, email")
    .eq("id", userId)
    .single();

  if (fetchError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const newStatus = !(user.is_active ?? true);

  const { error } = await db
    .from("users")
    .update({ is_active: newStatus })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction(
    check.userId,
    newStatus ? "enable_user" : "disable_user",
    "user",
    userId,
    { email: user.email },
  );

  return NextResponse.json({ is_active: newStatus });
}
