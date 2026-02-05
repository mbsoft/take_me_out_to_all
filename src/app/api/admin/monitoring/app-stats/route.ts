import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();

  const [
    totalUsers,
    activeUsers,
    usersToday,
    usersWeek,
    totalItineraries,
    itToday,
    itWeek,
    gameCount,
    itGoals,
    popularTeams,
  ] = await Promise.all([
    db.from("users").select("*", { count: "exact", head: true }),
    db.from("users").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("users").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
    db.from("users").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    db.from("itineraries").select("*", { count: "exact", head: true }),
    db.from("itineraries").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
    db.from("itineraries").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    db.from("itinerary_games").select("*", { count: "exact", head: true }),
    db.from("itineraries").select("goal"),
    db.from("itinerary_games").select("game_id, games(home_team)").limit(1000),
  ]);

  // Goal distribution
  const goals = { all: 0, al: 0, nl: 0 };
  for (const it of itGoals.data || []) {
    const g = (it.goal as string) || "all";
    if (g in goals) goals[g as keyof typeof goals]++;
  }

  // Popular teams
  const teamCounts = new Map<string, number>();
  for (const row of popularTeams.data || []) {
    const game = row.games as unknown as { home_team: string } | null;
    const team = game?.home_team;
    if (team) teamCounts.set(team, (teamCounts.get(team) || 0) + 1);
  }
  const topTeams = Array.from(teamCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([team, count]) => ({ team, count }));

  const totalIt = totalItineraries.count ?? 0;
  const totalGames = gameCount.count ?? 0;

  return NextResponse.json({
    users: {
      total: totalUsers.count ?? 0,
      active: activeUsers.count ?? 0,
      registered_today: usersToday.count ?? 0,
      registered_this_week: usersWeek.count ?? 0,
    },
    itineraries: {
      total: totalIt,
      created_today: itToday.count ?? 0,
      created_this_week: itWeek.count ?? 0,
      avg_games_per_itinerary: totalIt > 0 ? Math.round((totalGames / totalIt) * 10) / 10 : 0,
    },
    popular_teams: topTeams,
    popular_goals: goals,
  });
}
