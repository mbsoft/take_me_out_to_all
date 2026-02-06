export interface CostDefaults {
  mileageRate: number;
  airfareBase: number;
  airfarePerMile: number;
  hotelPerNight: number;
  parkingPerGame: number;
  ticketsPerGame: number;
}

export interface SegmentCost {
  mode: "car" | "air";
  distanceMiles: number;
  cost: number;
}

export interface GameCost {
  gameId: number;
  homeTeam: string;
  ticketPriceEach: number | null;
  ticketTotal: number;
  parking: number;
}

export interface TripCostBreakdown {
  travel: { driving: number; flights: number; total: number };
  tickets: { total: number; perGame: GameCost[] };
  hotels: { nights: number; total: number };
  parking: { total: number };
  grandTotal: number;
  segments: SegmentCost[];
}

export function getDefaultCosts(): CostDefaults {
  return {
    mileageRate: 0.7,
    airfareBase: 150,
    airfarePerMile: 0.08,
    hotelPerNight: 150,
    parkingPerGame: 30,
    ticketsPerGame: 2,
  };
}

export function calculateSegmentCost(
  distanceMeters: number,
  mode: "car" | "air",
  defaults: CostDefaults
): SegmentCost {
  const miles = distanceMeters / 1609.34;
  const cost =
    mode === "air"
      ? defaults.airfareBase + miles * defaults.airfarePerMile
      : miles * defaults.mileageRate;
  return { mode, distanceMiles: Math.round(miles), cost: Math.round(cost) };
}

/** Count overnight stays needed between first and last game dates. */
export function calculateHotelNights(
  games: Array<{ date_time: string }>
): number {
  if (games.length < 2) return games.length > 0 ? 1 : 0;
  const dates = games
    .map((g) => new Date(g.date_time))
    .sort((a, b) => a.getTime() - b.getTime());
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  const diffMs = last.getTime() - first.getTime();
  const nights = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, nights);
}

export function calculateTripCosts(
  legs: Array<{ distance: number; duration: number; mode: string }>,
  games: Array<{ game_id: number; home_team: string; date_time: string }>,
  ticketPrices: Record<number, number | null>,
  defaults: CostDefaults = getDefaultCosts()
): TripCostBreakdown {
  // Segments
  let drivingTotal = 0;
  let flightsTotal = 0;
  const segments: SegmentCost[] = legs.map((leg) => {
    const mode = leg.mode === "air" ? "air" : ("car" as const);
    const seg = calculateSegmentCost(leg.distance, mode, defaults);
    if (mode === "air") flightsTotal += seg.cost;
    else drivingTotal += seg.cost;
    return seg;
  });

  // Per-game costs
  const perGame: GameCost[] = games.map((g) => {
    const priceEach = ticketPrices[g.game_id] ?? null;
    const ticketTotal =
      priceEach != null ? priceEach * defaults.ticketsPerGame : 0;
    return {
      gameId: g.game_id,
      homeTeam: g.home_team,
      ticketPriceEach: priceEach,
      ticketTotal,
      parking: defaults.parkingPerGame,
    };
  });

  const ticketsTotal = perGame.reduce((s, g) => s + g.ticketTotal, 0);
  const parkingTotal = perGame.reduce((s, g) => s + g.parking, 0);

  // Hotels
  const nights = calculateHotelNights(games);
  const hotelsTotal = nights * defaults.hotelPerNight;

  const grandTotal =
    drivingTotal + flightsTotal + ticketsTotal + hotelsTotal + parkingTotal;

  return {
    travel: {
      driving: drivingTotal,
      flights: flightsTotal,
      total: drivingTotal + flightsTotal,
    },
    tickets: { total: ticketsTotal, perGame },
    hotels: { nights, total: hotelsTotal },
    parking: { total: parkingTotal },
    grandTotal,
    segments,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
