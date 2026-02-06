import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateTripCosts, getDefaultCosts } from "@/lib/cost-calculator";

const SEATGEEK_CLIENT_ID = process.env.SEATGEEK_CLIENT_ID;
const SEATGEEK_CLIENT_SECRET = process.env.SEATGEEK_CLIENT_SECRET;

const TEAM_SLUGS: Record<string, string> = {
  ARI: "arizona-diamondbacks", ATH: "oakland-athletics", ATL: "atlanta-braves",
  BAL: "baltimore-orioles", BOS: "boston-red-sox", CHC: "chicago-cubs",
  CHW: "chicago-white-sox", CIN: "cincinnati-reds", CLE: "cleveland-guardians",
  COL: "colorado-rockies", DET: "detroit-tigers", HOU: "houston-astros",
  KC: "kansas-city-royals", LAA: "los-angeles-angels", LAD: "los-angeles-dodgers",
  MIA: "miami-marlins", MIL: "milwaukee-brewers", MIN: "minnesota-twins",
  NYM: "new-york-mets", NYY: "new-york-yankees", PHI: "philadelphia-phillies",
  PIT: "pittsburgh-pirates", SD: "san-diego-padres", SEA: "seattle-mariners",
  SF: "san-francisco-giants", STL: "st-louis-cardinals", TB: "tampa-bay-rays",
  TEX: "texas-rangers", TOR: "toronto-blue-jays", WSH: "washington-nationals",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";
  let itineraryQuery = db.from("itineraries").select("*").eq("id", id);
  if (!isAdmin) {
    itineraryQuery = itineraryQuery.eq("user_id", session.user.id);
  }
  const { data: itinerary, error: itineraryError } = await itineraryQuery.single();
  if (itineraryError || !itinerary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch games
  const { data: itineraryGames } = await db
    .from("itinerary_games")
    .select("*, games(*)")
    .eq("itinerary_id", id)
    .order("sort_order", { ascending: true });

  const games = (itineraryGames || []).map((ig: any) => ({
    game_id: ig.games.game_id,
    home_team: ig.games.home_team,
    away_team: ig.games.away_team,
    date_time: ig.games.date_time,
  }));

  if (games.length === 0) {
    return NextResponse.json({ breakdown: null });
  }

  // Extract legs from cached route_geometry
  let legs: Array<{ distance: number; duration: number; mode: string }> = [];
  if (itinerary.route_geometry) {
    try {
      const cached = JSON.parse(itinerary.route_geometry);
      legs = cached.legs ?? [];
    } catch {
      // no cached route data
    }
  }

  // Fetch ticket prices from SeatGeek
  const ticketPrices: Record<number, number | null> = {};
  if (SEATGEEK_CLIENT_ID && SEATGEEK_CLIENT_SECRET) {
    await Promise.all(
      games.map(async (g: any) => {
        const homeSlug = TEAM_SLUGS[g.home_team?.toUpperCase()];
        if (!homeSlug) {
          ticketPrices[g.game_id] = null;
          return;
        }
        const date = new Date(g.date_time);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        const sgParams = new URLSearchParams({
          client_id: SEATGEEK_CLIENT_ID!,
          client_secret: SEATGEEK_CLIENT_SECRET!,
          type: "mlb",
          "performers.slug": homeSlug,
          "datetime_utc.gte": dayStart.toISOString(),
          "datetime_utc.lte": dayEnd.toISOString(),
          per_page: "1",
        });
        try {
          const res = await fetch(
            `https://api.seatgeek.com/2/events?${sgParams}`,
            { next: { revalidate: 300 } }
          );
          if (res.ok) {
            const data = await res.json();
            const avg = data.events?.[0]?.stats?.average_price ?? null;
            ticketPrices[g.game_id] = avg;
          } else {
            ticketPrices[g.game_id] = null;
          }
        } catch {
          ticketPrices[g.game_id] = null;
        }
      })
    );
  }

  const breakdown = calculateTripCosts(legs, games, ticketPrices, getDefaultCosts());

  return NextResponse.json({ breakdown });
}
