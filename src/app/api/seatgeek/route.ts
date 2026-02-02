import { NextRequest, NextResponse } from "next/server";

// Map our team abbreviations to SeatGeek performer slugs
const TEAM_SLUGS: Record<string, string> = {
  ARI: "arizona-diamondbacks",
  ATH: "oakland-athletics",
  ATL: "atlanta-braves",
  BAL: "baltimore-orioles",
  BOS: "boston-red-sox",
  CHC: "chicago-cubs",
  CHW: "chicago-white-sox",
  CIN: "cincinnati-reds",
  CLE: "cleveland-guardians",
  COL: "colorado-rockies",
  DET: "detroit-tigers",
  HOU: "houston-astros",
  KC: "kansas-city-royals",
  LAA: "los-angeles-angels",
  LAD: "los-angeles-dodgers",
  MIA: "miami-marlins",
  MIL: "milwaukee-brewers",
  MIN: "minnesota-twins",
  NYM: "new-york-mets",
  NYY: "new-york-yankees",
  PHI: "philadelphia-phillies",
  PIT: "pittsburgh-pirates",
  SD: "san-diego-padres",
  SEA: "seattle-mariners",
  SF: "san-francisco-giants",
  STL: "st-louis-cardinals",
  TB: "tampa-bay-rays",
  TEX: "texas-rangers",
  TOR: "toronto-blue-jays",
  WSH: "washington-nationals",
};

export async function GET(req: NextRequest) {
  const homeTeam = req.nextUrl.searchParams.get("home_team");
  const awayTeam = req.nextUrl.searchParams.get("away_team");
  const dateTime = req.nextUrl.searchParams.get("date_time");

  if (!homeTeam || !awayTeam || !dateTime) {
    return NextResponse.json({ error: "home_team, away_team, and date_time required" }, { status: 400 });
  }

  const clientId = process.env.SEATGEEK_CLIENT_ID;
  const clientSecret = process.env.SEATGEEK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "SeatGeek not configured" }, { status: 500 });
  }

  const homeSlug = TEAM_SLUGS[homeTeam.toUpperCase()];
  if (!homeSlug) {
    return NextResponse.json({ error: "Unknown team" }, { status: 400 });
  }

  // Parse the date to create a range (same day)
  const date = new Date(dateTime);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    type: "mlb",
    "performers.slug": homeSlug,
    "datetime_utc.gte": dayStart.toISOString(),
    "datetime_utc.lte": dayEnd.toISOString(),
    per_page: "5",
  });

  const url = `https://api.seatgeek.com/2/events?${params}`;
  console.log("[SeatGeek] Request URL:", url);

  try {
    const res = await fetch(url, {
      next: { revalidate: 300 }, // cache for 5 min
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("SeatGeek API error:", res.status, text);
      return NextResponse.json({ error: "SeatGeek API error" }, { status: 502 });
    }

    const data = await res.json();
    console.log("[SeatGeek] Response:", JSON.stringify(data, null, 2));
    const events = (data.events || []).map((e: any) => ({
      id: e.id,
      title: e.title,
      url: e.url,
      datetime_utc: e.datetime_utc,
      datetime_local: e.datetime_local,
      venue: {
        name: e.venue?.name,
        city: e.venue?.city,
        state: e.venue?.state,
      },
      stats: {
        lowest_price: e.stats?.lowest_price,
        average_price: e.stats?.average_price,
        highest_price: e.stats?.highest_price,
        listing_count: e.stats?.listing_count,
      },
      performers: (e.performers || []).map((p: any) => ({
        name: p.name,
        image: p.image,
        slug: p.slug,
      })),
    }));

    return NextResponse.json({ events });
  } catch (err) {
    console.error("SeatGeek fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch from SeatGeek" }, { status: 502 });
  }
}
