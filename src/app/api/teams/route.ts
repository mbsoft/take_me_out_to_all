import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const { data, error } = await db
    .from("teams")
    .select("*")
    .order("name");
  if (error) {
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
  return NextResponse.json(data);
}
