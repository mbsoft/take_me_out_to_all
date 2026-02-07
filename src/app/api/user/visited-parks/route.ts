import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await db
    .from("user_visited_parks")
    .select("team_abbr, visited_at, notes")
    .eq("user_id", session.user.id);

  if (error) {
    console.error("Failed to fetch visited parks:", error);
    return NextResponse.json({ error: "Failed to fetch visited parks" }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamAbbr, visited, visitedAt, notes } = await req.json();

  if (!teamAbbr) {
    return NextResponse.json({ error: "Team abbreviation is required" }, { status: 400 });
  }

  if (visited) {
    // Add or update visited park
    const { error } = await db.from("user_visited_parks").upsert(
      {
        id: uuidv4(),
        user_id: session.user.id,
        team_abbr: teamAbbr,
        visited_at: visitedAt || null,
        notes: notes || null,
      },
      { onConflict: "user_id,team_abbr" }
    );

    if (error) {
      console.error("Failed to save visited park:", error);
      return NextResponse.json({ error: "Failed to save visited park" }, { status: 500 });
    }
  } else {
    // Remove visited park
    const { error } = await db
      .from("user_visited_parks")
      .delete()
      .eq("user_id", session.user.id)
      .eq("team_abbr", teamAbbr);

    if (error) {
      console.error("Failed to remove visited park:", error);
      return NextResponse.json({ error: "Failed to remove visited park" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
