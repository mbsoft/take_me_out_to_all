import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { id } = await params;

  // Fetch current state
  const { data: template, error: fetchErr } = await db
    .from("itinerary_templates")
    .select("is_active")
    .eq("id", id)
    .single();

  if (fetchErr || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const newState = !template.is_active;

  const { error } = await db
    .from("itinerary_templates")
    .update({ is_active: newState, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to toggle template" }, { status: 500 });
  }

  await logAdminAction(check.userId, "toggle_template_active", "template", id, {
    is_active: newState,
  });

  return NextResponse.json({ is_active: newState });
}
