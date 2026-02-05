import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createVerificationToken } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const { data: user } = await db
    .from("users")
    .select("id, email_verified, password_hash")
    .eq("email", email)
    .single();

  // Always return same message to prevent email enumeration
  if (!user || user.email_verified || !user.password_hash) {
    return NextResponse.json({
      message: "If that email exists and is unverified, a new link has been sent.",
    });
  }

  const token = await createVerificationToken(user.id);
  await sendVerificationEmail(email, token);

  return NextResponse.json({
    message: "If that email exists and is unverified, a new link has been sent.",
  });
}
