import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const team = params.get("team");
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const dayOnly = params.get("dayOnly");

  let query = db
    .from("games")
    .select("*")
    .neq("status", "Canceled");

  if (team) {
    // Supabase OR syntax: field.eq.value,field2.eq.value2
    query = query.or(`home_team.eq.${team},away_team.eq.${team}`);
  }
  if (startDate) {
    query = query.gte("day", startDate);
  }
  if (endDate) {
    query = query.lte("day", endDate);
  }

  const { data, error } = await query.order("date_time", { ascending: true });
  if (error) {
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }

  // Filter day games in JavaScript if needed (Supabase query builder doesn't easily support EXTRACT)
  let filteredData = data || [];
  if (dayOnly === "true") {
    filteredData = filteredData.filter((game: any) => {
      const hour = parseInt(game.date_time?.substring(11, 13) || "0");
      return hour < 17;
    });
  }

  return NextResponse.json(filteredData);
}
