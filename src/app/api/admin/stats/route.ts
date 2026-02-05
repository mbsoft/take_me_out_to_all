import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();

  // Run queries in parallel
  const [
    totalUsersRes,
    activeUsersRes,
    adminUsersRes,
    totalItinerariesRes,
    totalGamesRes,
    apiCallsTodayRes,
    apiCallsWeekRes,
    recentUsersRes,
    recentAuditRes,
  ] = await Promise.all([
    db.from("users").select("*", { count: "exact", head: true }),
    db.from("users").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("users").select("*", { count: "exact", head: true }).eq("role", "admin"),
    db.from("itineraries").select("*", { count: "exact", head: true }),
    db.from("itinerary_games").select("*", { count: "exact", head: true }),
    db.from("api_usage_log").select("*", { count: "exact", head: true }).gte("timestamp", todayStart),
    db.from("api_usage_log").select("*", { count: "exact", head: true }).gte("timestamp", weekAgo),
    db.from("users").select("id, email, name, role, is_active, created_at").order("created_at", { ascending: false }).limit(5),
    db.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(10),
  ]);

  return NextResponse.json({
    totalUsers: totalUsersRes.count ?? 0,
    activeUsers: activeUsersRes.count ?? 0,
    adminUsers: adminUsersRes.count ?? 0,
    totalItineraries: totalItinerariesRes.count ?? 0,
    totalGamesPlanned: totalGamesRes.count ?? 0,
    apiCallsToday: apiCallsTodayRes.count ?? 0,
    apiCallsThisWeek: apiCallsWeekRes.count ?? 0,
    recentRegistrations: recentUsersRes.data ?? [],
    recentAuditLog: recentAuditRes.data ?? [],
  });
}
