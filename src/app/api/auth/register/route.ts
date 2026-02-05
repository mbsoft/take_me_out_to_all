import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { db } from "@/lib/db";
import { createVerificationToken } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";
import { seedTemplatesForUser } from "@/lib/template-seeder";

export async function POST(req: Request) {
  const { email, password } = await req.json();
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
    .insert({ id, email, password_hash: hash, name: null, email_verified: false });
  if (error) {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }

  // Seed example itineraries from active templates
  try {
    await seedTemplatesForUser(id);
  } catch (seedError) {
    console.error("Failed to seed templates for new user:", seedError);
  }

  // Generate verification token and send email
  try {
    const token = await createVerificationToken(id);
    await sendVerificationEmail(email, token);
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    // User is created but email failed — still return success so they can resend
  }

  return NextResponse.json({ id, email, requiresVerification: true }, { status: 201 });
}
