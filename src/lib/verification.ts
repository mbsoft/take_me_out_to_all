import crypto from "crypto";
import { db } from "./db";

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createVerificationToken(userId: string): Promise<string> {
  const token = generateVerificationToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db
    .from("users")
    .update({
      verification_token: token,
      verification_token_expires: expires.toISOString(),
    })
    .eq("id", userId);

  return token;
}

export async function verifyToken(
  token: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const { data: user, error } = await db
    .from("users")
    .select("id, email_verified, verification_token_expires")
    .eq("verification_token", token)
    .single();

  if (error || !user) {
    return { success: false, error: "Invalid verification link." };
  }

  if (user.email_verified) {
    return { success: true, userId: user.id };
  }

  const expires = new Date(user.verification_token_expires);
  if (expires < new Date()) {
    return {
      success: false,
      error: "This verification link has expired. Please request a new one.",
    };
  }

  await db
    .from("users")
    .update({
      email_verified: true,
      verification_token: null,
      verification_token_expires: null,
    })
    .eq("id", user.id);

  return { success: true, userId: user.id };
}
