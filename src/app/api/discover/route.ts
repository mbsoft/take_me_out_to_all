import { NextRequest, NextResponse } from "next/server";

/** NextBillion Discover API proxy. Returns places with label and lat/lng for autocomplete. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ items: [] });
  }

  const NBAI_API_KEY = process.env.NBAI_API_KEY || process.env.NEXT_PUBLIC_NBAI_API_KEY;
  if (!NBAI_API_KEY) {
    return NextResponse.json({ error: "Discover API key not configured" }, { status: 500 });
  }

  const at = req.nextUrl.searchParams.get("at") ?? "39.8283,-98.5795"; // US center
  const limit = req.nextUrl.searchParams.get("limit") ?? "8";

  const url = new URL("https://api.nextbillion.io/discover");
  url.searchParams.set("key", NBAI_API_KEY);
  url.searchParams.set("q", q.trim());
  url.searchParams.set("at", at);
  url.searchParams.set("limit", limit);
  url.searchParams.set("in", "countryCode:USA");

  console.log("[Discover] Full URL:", url.toString());
  console.log("[Discover] API key used:", NBAI_API_KEY ? `${NBAI_API_KEY.slice(0, 6)}...${NBAI_API_KEY.slice(-4)}` : "MISSING");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) {
      const text = await res.text();
      console.warn("NextBillion Discover API error:", res.status, text);
      return NextResponse.json({ items: [] });
    }
    const data = (await res.json()) as {
      items?: Array<{
        title?: string;
        address?: { label?: string };
        position?: { lat?: number; lng?: number };
      }>;
    };
    const items = (data.items ?? []).map((item) => ({
      label: item.address?.label ?? item.title ?? "",
      lat: item.position?.lat,
      lng: item.position?.lng,
    })).filter((item) => item.label && item.lat != null && item.lng != null);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Discover API error:", err);
    return NextResponse.json({ items: [] });
  }
}
