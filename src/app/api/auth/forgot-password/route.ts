import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

const GENERIC_MESSAGE = "If an account exists with that email, a reset link has been sent.";

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const { data: user } = await db
    .from("users")
    .select("id, password_hash, is_active")
    .eq("email", email)
    .single();

  // Anti-enumeration: always return same message
  if (!user || !user.password_hash || user.is_active === false) {
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .from("users")
    .update({
      password_reset_token: token,
      password_reset_token_expires: expires.toISOString(),
    })
    .eq("id", user.id);

  try {
    await sendPasswordResetEmail(email, token);
  } catch (emailError) {
    console.error("Failed to send password reset email:", emailError);
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
