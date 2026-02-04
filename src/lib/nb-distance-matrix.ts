/**
 * NextBillion.ai Distance Matrix API client.
 * Returns real driving distances (miles) and durations (hours) between all location pairs.
 */

const METERS_TO_MILES = 0.000621371;
const SECONDS_TO_HOURS = 1 / 3600;

export interface DrivingMatrix {
  /** NxN matrix of driving distances in miles */
  distances: number[][];
  /** NxN matrix of driving durations in hours */
  durations: number[][];
}

interface Location {
  lat: number;
  lon: number;
}

interface DMElement {
  distance?: { value?: number };
  duration?: { value?: number };
  status?: string;
}

interface DMRow {
  elements: DMElement[];
}

interface DMResponse {
  status?: string;
  rows?: DMRow[];
}

/**
 * Fetch the NxN driving distance/duration matrix for a set of locations
 * using the NextBillion.ai Distance Matrix (Fast) API.
 *
 * All locations are used as both origins and destinations to produce a full NxN matrix.
 * Distances are returned in miles, durations in hours.
 *
 * @throws if the API call fails or the response is malformed
 */
export async function fetchDrivingMatrix(locations: Location[]): Promise<DrivingMatrix> {
  const NBAI_API_KEY = process.env.NBAI_API_KEY || process.env.NEXT_PUBLIC_NBAI_API_KEY;
  if (!NBAI_API_KEY) {
    throw new Error("NBAI_API_KEY not configured");
  }

  const n = locations.length;
  if (n < 2) {
    throw new Error("Need at least 2 locations for distance matrix");
  }

  // Build pipe-separated coordinate strings: "lat,lng|lat,lng|..."
  const coordStr = locations.map((l) => `${l.lat},${l.lon}`).join("|");

  const url = new URL("https://api.nextbillion.io/distancematrix/json");
  url.searchParams.set("key", NBAI_API_KEY);
  url.searchParams.set("origins", coordStr);
  url.searchParams.set("destinations", coordStr);
  url.searchParams.set("mode", "car");

  console.log(`[DistanceMatrix] Fetching ${n}x${n} matrix (${n * n} elements)`);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Distance Matrix API error ${res.status}: ${text}`);
  }

  const data: DMResponse = await res.json();

  if (data.status !== "Ok" || !data.rows || data.rows.length !== n) {
    throw new Error(
      `Distance Matrix API unexpected response: status=${data.status}, rows=${data.rows?.length ?? 0}`
    );
  }

  // Parse into NxN matrices
  const distances: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const durations: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    const row = data.rows[i];
    if (!row?.elements || row.elements.length !== n) {
      throw new Error(`Distance Matrix row ${i} has ${row?.elements?.length ?? 0} elements, expected ${n}`);
    }
    for (let j = 0; j < n; j++) {
      const el = row.elements[j];
      if (el?.status === "OK" || el?.distance?.value != null) {
        distances[i][j] = (el.distance?.value ?? 0) * METERS_TO_MILES;
        durations[i][j] = (el.duration?.value ?? 0) * SECONDS_TO_HOURS;
      }
      // If element status is not OK (no route), values stay 0 — caller uses haversine fallback
    }
  }

  console.log(`[DistanceMatrix] Successfully parsed ${n}x${n} matrix`);
  return { distances, durations };
}
