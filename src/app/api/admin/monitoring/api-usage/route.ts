import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const period = req.nextUrl.searchParams.get("period") || "7d";
  const days = period === "today" ? 1 : period === "30d" ? 30 : 7;
  const since = new Date(Date.now() - days * 24 * 3600_000).toISOString();

  // Fetch raw logs for the period
  const { data: logs, error } = await db
    .from("api_usage_log")
    .select("api_name, endpoint, method, status_code, response_time_ms, timestamp")
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entries = logs || [];

  // Summary
  const totalCalls = entries.length;
  const avgResponse = totalCalls > 0
    ? Math.round(entries.reduce((s, e) => s + (e.response_time_ms || 0), 0) / totalCalls)
    : 0;
  const errorCount = entries.filter((e) => (e.status_code || 0) >= 400).length;
  const errorRate = totalCalls > 0 ? Math.round((errorCount / totalCalls) * 10000) / 100 : 0;

  // By API
  const byApiMap = new Map<string, { calls: number; totalMs: number; errors: number }>();
  for (const e of entries) {
    const name = e.api_name || "unknown";
    const existing = byApiMap.get(name) || { calls: 0, totalMs: 0, errors: 0 };
    existing.calls++;
    existing.totalMs += e.response_time_ms || 0;
    if ((e.status_code || 0) >= 400) existing.errors++;
    byApiMap.set(name, existing);
  }
  const byApi = Array.from(byApiMap.entries()).map(([name, data]) => ({
    api_name: name,
    total_calls: data.calls,
    avg_response_ms: Math.round(data.totalMs / data.calls),
    error_count: data.errors,
  }));

  // Daily breakdown
  const dailyMap = new Map<string, Map<string, { count: number; totalMs: number; errors: number }>>();
  for (const e of entries) {
    const date = e.timestamp?.split("T")[0] || "unknown";
    const api = e.api_name || "unknown";
    if (!dailyMap.has(date)) dailyMap.set(date, new Map());
    const dayApis = dailyMap.get(date)!;
    const existing = dayApis.get(api) || { count: 0, totalMs: 0, errors: 0 };
    existing.count++;
    existing.totalMs += e.response_time_ms || 0;
    if ((e.status_code || 0) >= 400) existing.errors++;
    dayApis.set(api, existing);
  }
  const dailyBreakdown: Array<{
    date: string;
    api_name: string;
    call_count: number;
    avg_response_ms: number;
    error_count: number;
  }> = [];
  for (const [date, apis] of dailyMap) {
    for (const [api, data] of apis) {
      dailyBreakdown.push({
        date,
        api_name: api,
        call_count: data.count,
        avg_response_ms: Math.round(data.totalMs / data.count),
        error_count: data.errors,
      });
    }
  }
  dailyBreakdown.sort((a, b) => b.date.localeCompare(a.date));

  // Recent errors
  const recentErrors = entries
    .filter((e) => (e.status_code || 0) >= 400)
    .slice(0, 20)
    .map((e) => ({
      timestamp: e.timestamp,
      api_name: e.api_name,
      endpoint: e.endpoint,
      status_code: e.status_code,
      response_time_ms: e.response_time_ms,
    }));

  return NextResponse.json({
    summary: { total_calls: totalCalls, avg_response_ms: avgResponse, error_rate: errorRate },
    by_api: byApi,
    daily_breakdown: dailyBreakdown,
    recent_errors: recentErrors,
  });
}
