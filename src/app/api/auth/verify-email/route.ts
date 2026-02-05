import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/verification";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const baseUrl = getBaseUrl();

  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?error=missing-token", baseUrl));
  }

  const result = await verifyToken(token);

  if (!result.success) {
    const errorParam = encodeURIComponent(result.error || "Verification failed");
    return NextResponse.redirect(new URL(`/verify-email?error=${errorParam}`, baseUrl));
  }

  return NextResponse.redirect(new URL("/login?verified=true", baseUrl));
}
