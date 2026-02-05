import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { id } = await params;

  const { data: template, error } = await db
    .from("itinerary_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const { data: games } = await db
    .from("itinerary_template_games")
    .select("*")
    .eq("template_id", id)
    .order("sort_order", { ascending: true });

  const { data: stopovers } = await db
    .from("itinerary_template_stopovers")
    .select("*")
    .eq("template_id", id);

  // Get creator email
  const { data: creator } = await db
    .from("users")
    .select("email")
    .eq("id", template.created_by)
    .single();

  return NextResponse.json({
    ...template,
    games: games || [],
    stopovers: stopovers || [],
    creator_email: creator?.email || "unknown",
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { id } = await params;
  const body = await req.json();

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.name !== undefined) update.name = body.name;
  if (body.description !== undefined) update.description = body.description;
  if (body.is_active !== undefined) update.is_active = body.is_active;

  const { error } = await db
    .from("itinerary_templates")
    .update(update)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }

  await logAdminAction(check.userId, "update_template", "template", id, update);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { id } = await params;

  const { error } = await db
    .from("itinerary_templates")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }

  await logAdminAction(check.userId, "delete_template", "template", id);

  return NextResponse.json({ ok: true });
}
