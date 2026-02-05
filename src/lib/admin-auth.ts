import { auth } from "./auth";
import { db } from "./db";
import { NextResponse } from "next/server";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { authorized: false as const, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (session.user.role !== "admin") {
    return { authorized: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { authorized: true as const, session, userId: session.user.id };
}

export async function logAdminAction(
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>,
) {
  await db.from("admin_audit_log").insert({
    admin_id: adminId,
    action,
    target_type: targetType || null,
    target_id: targetId || null,
    details: details || null,
  });
}
