import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const { data: user } = await db
    .from("users")
    .select("id, password_hash, password_reset_token_expires")
    .eq("password_reset_token", token)
    .single();

  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const expires = new Date(user.password_reset_token_expires);
  if (expires < new Date()) {
    return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
  }

  if (!user.password_hash) {
    return NextResponse.json({ error: "This account uses Google sign-in and does not have a password to reset." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);

  await db
    .from("users")
    .update({
      password_hash: hash,
      password_reset_token: null,
      password_reset_token_expires: null,
    })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
