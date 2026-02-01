import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { email, password, name } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("email", email)
    .single();
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const id = uuid();
  const hash = await bcrypt.hash(password, 10);
  const { error } = await db
    .from("users")
    .insert({ id, email, password_hash: hash, name: name || null });
  if (error) {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }

  return NextResponse.json({ id, email }, { status: 201 });
}
