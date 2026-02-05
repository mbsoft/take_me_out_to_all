import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role") || "";
  const active = searchParams.get("active") || "";

  const offset = (page - 1) * limit;

  let query = db
    .from("users")
    .select("id, email, name, role, is_active, created_at, password_hash", { count: "exact" });

  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
  }
  if (role) {
    query = query.eq("role", role);
  }
  if (active === "true") {
    query = query.eq("is_active", true);
  } else if (active === "false") {
    query = query.eq("is_active", false);
  }

  const { data: users, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get itinerary counts per user
  const userIds = (users || []).map((u) => u.id);
  const { data: itCounts } = await db
    .from("itineraries")
    .select("user_id")
    .in("user_id", userIds);

  const countMap = new Map<string, number>();
  for (const row of itCounts || []) {
    countMap.set(row.user_id, (countMap.get(row.user_id) || 0) + 1);
  }

  const mapped = (users || []).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role || "user",
    is_active: u.is_active ?? true,
    created_at: u.created_at,
    itinerary_count: countMap.get(u.id) || 0,
    has_password: !!u.password_hash,
  }));

  return NextResponse.json({
    users: mapped,
    total: count ?? 0,
    page,
    limit,
  });
}
