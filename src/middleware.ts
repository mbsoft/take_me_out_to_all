import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

function baseUrl(req: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const origin = baseUrl(req);

  // Protect /admin routes (except /admin/login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!req.auth) {
      return NextResponse.redirect(new URL("/admin/login", origin));
    }
    if (req.auth.user?.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", origin));
    }
  }

  // Protect /api/admin/* routes
  if (pathname.startsWith("/api/admin")) {
    if (!req.auth || req.auth.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Email verification enforcement
  const protectedPages = ["/dashboard", "/onboarding", "/itinerary"];
  const isProtectedPage = protectedPages.some((p) => pathname.startsWith(p));
  const isProtectedApi = pathname.startsWith("/api/itineraries");

  if (req.auth && (isProtectedPage || isProtectedApi)) {
    // Admin users exempt from email verification
    if (req.auth.user?.role === "admin") {
      return NextResponse.next();
    }

    // Check isEmailVerified at both session and token level
    // NextAuth v5 middleware may expose token properties directly on req.auth
    const sessionVerified = req.auth.user?.isEmailVerified;
    const tokenVerified = (req.auth as unknown as Record<string, unknown>).isEmailVerified;
    const isVerified = sessionVerified ?? tokenVerified;

    console.log("[middleware] email verification check:", {
      pathname,
      sessionVerified,
      tokenVerified,
      isVerified,
      user: req.auth.user,
    });

    if (isVerified === false) {
      if (isProtectedApi) {
        return NextResponse.json({ error: "Email not verified" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/verify-email", origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/itinerary/:path*",
    "/api/itineraries/:path*",
  ],
};
