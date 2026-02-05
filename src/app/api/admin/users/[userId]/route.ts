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

  const { data: user, error } = await db
    .from("users")
    .select("id, email, name, role, is_active, created_at, password_hash")
    .eq("id", userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get itinerary count
  const { count: itineraryCount } = await db
    .from("itineraries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || "user",
    is_active: user.is_active ?? true,
    created_at: user.created_at,
    has_password: !!user.password_hash,
    itinerary_count: itineraryCount ?? 0,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { userId } = await params;
  const body = await req.json();

  const allowedFields: Record<string, unknown> = {};
  if (body.role !== undefined) allowedFields.role = body.role;
  if (body.is_active !== undefined) allowedFields.is_active = body.is_active;
  if (body.name !== undefined) allowedFields.name = body.name;

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await db
    .from("users")
    .update(allowedFields)
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction(check.userId, "update_user", "user", userId, allowedFields);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { userId } = await params;

  // Prevent self-deletion
  if (userId === check.userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  // Get user info before deletion for audit log
  const { data: user } = await db
    .from("users")
    .select("email")
    .eq("id", userId)
    .single();

  const { error } = await db
    .from("users")
    .delete()
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction(check.userId, "delete_user", "user", userId, {
    email: user?.email,
  });

  return NextResponse.json({ success: true });
}
