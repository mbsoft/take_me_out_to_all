import { haversine } from "./haversine";
import type { DrivingMatrix } from "./nb-distance-matrix";

export type { DrivingMatrix };

export interface Park {
  abbr: string;
  lat: number;
  lon: number;
  stadium_name: string;
}

export interface ScheduledGame {
  game_id: number;
  home_team: string;
  away_team: string;
  date_time: string;
  date_time_utc: string;
  day: string;
}

export interface RouteStop {
  park: Park;
  game: ScheduledGame;
  distanceFromPrevious: number;
  travelMode: "car" | "air";
  gapHours: number;
}

export interface OptimizedRoute {
  stops: RouteStop[];
  totalDistanceMiles: number;
  estimatedDays: number;
  infeasibleParks: string[];
  segmentModes: string[];
}

interface Location {
  lat: number;
  lon: number;
}

const DRIVE_THRESHOLD = 500; // haversine miles — used to classify car vs air
const MIN_GAP_FLY_HOURS = 48;
const DRIVE_BUFFER_HOURS = 6; // buffer on top of real driving time (rest, food, hotel)
const FALLBACK_MIN_GAP_DRIVE_HOURS = 24; // used when no driving duration data

/**
 * Build NxN distance and duration matrices for a list of locations.
 * If a DrivingMatrix from the NB.ai API is provided, car-leg distances/durations
 * are replaced with real driving values. Air legs always use haversine.
 */
function buildMatrices(
  locations: Location[],
  drivingMatrix?: DrivingMatrix
): { distMatrix: number[][]; durationMatrix: number[][]; haversineMatrix: number[][] } {
  const n = locations.length;
  const haversineMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const distMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const durationMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const h = haversine(locations[i].lat, locations[i].lon, locations[j].lat, locations[j].lon);
      haversineMatrix[i][j] = h;
      haversineMatrix[j][i] = h;

      // Default to haversine
      distMatrix[i][j] = h;
      distMatrix[j][i] = h;

      // Estimate duration: haversine/55 mph for driving, rough flight time for air
      const estDriveHours = h / 55;
      durationMatrix[i][j] = estDriveHours;
      durationMatrix[j][i] = estDriveHours;

      // Overlay real driving data for car legs
      if (drivingMatrix && h < DRIVE_THRESHOLD) {
        const driveDist = drivingMatrix.distances[i]?.[j];
        const driveDur = drivingMatrix.durations[i]?.[j];
        if (driveDist && driveDist > 0) {
          distMatrix[i][j] = driveDist;
          distMatrix[j][i] = drivingMatrix.distances[j]?.[i] || driveDist;
        }
        if (driveDur && driveDur > 0) {
          durationMatrix[i][j] = driveDur;
          durationMatrix[j][i] = drivingMatrix.durations[j]?.[i] || driveDur;
        }
      }
    }
  }

  return { distMatrix, durationMatrix, haversineMatrix };
}

/** Binary search for the first game at or after earliestMs. */
function findEarliestGame(
  games: ScheduledGame[],
  earliestMs: number
): ScheduledGame | null {
  let lo = 0;
  let hi = games.length - 1;
  let result: ScheduledGame | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const gameMs = new Date(games[mid].date_time).getTime();
    if (gameMs >= earliestMs) {
      result = games[mid];
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return result;
}

/** Get minimum gap in hours between two locations, using real driving duration if available. */
function getMinGapHours(haversineMiles: number, drivingHours?: number): number {
  if (haversineMiles >= DRIVE_THRESHOLD) {
    return MIN_GAP_FLY_HOURS;
  }
  // Car leg: use real driving time + buffer, or fallback flat value
  if (drivingHours != null && drivingHours > 0) {
    return drivingHours + DRIVE_BUFFER_HOURS;
  }
  return FALLBACK_MIN_GAP_DRIVE_HOURS;
}

/** Get travel mode for a leg based on haversine distance and itinerary travel_mode. */
function getTravelMode(haversineMiles: number, travelMode?: string): "car" | "air" {
  if (travelMode === "drive") return "car";
  if (travelMode === "fly") return "air";
  return haversineMiles >= DRIVE_THRESHOLD ? "air" : "car";
}

/**
 * Greedy heuristic that picks the park with the SOONEST available game
 * at each step, rather than the nearest by distance. This avoids wasting
 * weeks waiting for a nearby team to return from a road trip when a farther
 * park has a game tomorrow.
 *
 * After the main pass, retries any remaining parks in additional passes
 * (the date has advanced, so previously-infeasible parks may now have games).
 */
function greedyEarliestGameOrder(
  parks: Park[],
  startLocation: Location,
  startDate: string,
  distMatrix: number[][],
  durationMatrix: number[][],
  haversineMatrix: number[][],
  gamesByPark: Map<string, ScheduledGame[]>,
): { order: number[]; infeasible: number[] } {
  const n = parks.length;
  const visited = new Set<number>();
  const order: number[] = [];

  let currentIdx = 0; // start location in distMatrix
  let currentDateMs = new Date(startDate).getTime();

  // Keep looping until no more parks can be added
  let madeProgress = true;
  while (visited.size < n && madeProgress) {
    madeProgress = false;

    // Find the unvisited park whose earliest feasible game is SOONEST
    let bestParkIdx = -1;
    let bestGameMs = Infinity;
    let bestGame: ScheduledGame | null = null;

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;
      const parkDistIdx = i + 1;

      const hDist = haversineMatrix[currentIdx][parkDistIdx];
      const dur = durationMatrix[currentIdx][parkDistIdx];
      const minGap = getMinGapHours(hDist, dur);
      const earliestArrivalMs = currentDateMs + minGap * 3600_000;
      const games = gamesByPark.get(parks[i].abbr) || [];
      const game = findEarliestGame(games, earliestArrivalMs);

      if (game) {
        const gameMs = new Date(game.date_time).getTime();
        if (gameMs < bestGameMs) {
          bestParkIdx = i;
          bestGameMs = gameMs;
          bestGame = game;
        }
      }
    }

    if (bestParkIdx !== -1) {
      visited.add(bestParkIdx);
      order.push(bestParkIdx);
      currentIdx = bestParkIdx + 1;
      currentDateMs = new Date(bestGame!.date_time).getTime();
      madeProgress = true;
    }
  }

  // Any parks still unvisited are truly infeasible (no games in the window)
  const infeasible: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!visited.has(i)) infeasible.push(i);
  }

  return { order, infeasible };
}

/**
 * 2-opt local search: reverse sub-segments to reduce total distance.
 * Operates on the geographic ordering only (ignoring game dates).
 * Start index is fixed (always first). End index is fixed if endLocation exists.
 */
function twoOptImprove(
  order: number[],
  distMatrix: number[][],
  startIdx: number,
  endIdx: number | null,
  maxIterations: number = 500
): number[] {
  const route = [...order];
  const n = route.length;
  if (n < 4) return route; // need at least 4 nodes for a swap

  // Build full route including start and optional end for distance calculation
  const fullRoute = () => {
    const r = [startIdx, ...route.map((i) => i + 1)]; // offset park indices
    if (endIdx !== null) r.push(endIdx);
    return r;
  };

  const totalDist = (r: number[]) => {
    let d = 0;
    for (let i = 0; i < r.length - 1; i++) {
      d += distMatrix[r[i]][r[i + 1]];
    }
    return d;
  };

  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        // Try reversing segment [i..j]
        const before = totalDist(fullRoute());
        const reversed = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)];
        const candidateRoute = [startIdx, ...reversed.map((k) => k + 1)];
        if (endIdx !== null) candidateRoute.push(endIdx);
        const after = totalDist(candidateRoute);

        if (after < before - 0.1) {
          // Accept improvement
          route.splice(0, route.length, ...reversed);
          improved = true;
        }
      }
    }
  }

  return route;
}

/**
 * Given an optimized park visit order, assign actual games respecting time constraints.
 * Uses matrix lookups for accurate distances/durations when available.
 */
function assignGames(
  parkOrder: Park[],
  allParks: Park[],
  startLocation: Location,
  startDate: string,
  gamesByPark: Map<string, ScheduledGame[]>,
  distMatrix: number[][],
  durationMatrix: number[][],
  haversineMatrix: number[][],
  travelMode?: string,
): { stops: RouteStop[]; infeasible: string[] } {
  const stops: RouteStop[] = [];
  const infeasible: string[] = [];

  // Build lookup: park abbr → matrix index (parks are at index 1..N in the matrix)
  const parkMatrixIdx = new Map<string, number>();
  for (let i = 0; i < allParks.length; i++) {
    parkMatrixIdx.set(allParks[i].abbr, i + 1);
  }

  let currentMatrixIdx = 0; // start location
  let currentDateMs = new Date(startDate).getTime();

  for (let i = 0; i < parkOrder.length; i++) {
    const park = parkOrder[i];
    const targetIdx = parkMatrixIdx.get(park.abbr);

    if (targetIdx == null) {
      infeasible.push(park.abbr);
      continue;
    }

    const dist = distMatrix[currentMatrixIdx][targetIdx];
    const hDist = haversineMatrix[currentMatrixIdx][targetIdx];
    const dur = durationMatrix[currentMatrixIdx][targetIdx];
    const mode = getTravelMode(hDist, travelMode);
    const minGap = getMinGapHours(hDist, dur);
    const earliestArrivalMs = currentDateMs + minGap * 3600_000;

    const games = gamesByPark.get(park.abbr) || [];
    const game = findEarliestGame(games, earliestArrivalMs);

    if (!game) {
      infeasible.push(park.abbr);
      continue;
    }

    const gameMs = new Date(game.date_time).getTime();
    const gapHours = (gameMs - currentDateMs) / 3600_000;

    stops.push({
      park,
      game,
      distanceFromPrevious: Math.round(dist),
      travelMode: mode,
      gapHours: Math.round(gapHours),
    });

    currentMatrixIdx = targetIdx;
    currentDateMs = gameMs;
  }

  return { stops, infeasible };
}

/**
 * Main entry point: generates an optimized route visiting all target parks.
 * If a DrivingMatrix is provided (from NB.ai Distance Matrix API), car-leg
 * distances and durations use real driving data instead of haversine estimates.
 */
export function optimizeRoute(
  startLocation: Location,
  endLocation: Location | null,
  startDate: string,
  parks: Park[],
  gamesByPark: Map<string, ScheduledGame[]>,
  drivingMatrix?: DrivingMatrix,
  travelMode?: string,
): OptimizedRoute {
  if (parks.length === 0) {
    return { stops: [], totalDistanceMiles: 0, estimatedDays: 0, infeasibleParks: [], segmentModes: [] };
  }

  // Build locations array: [startLocation, ...parks, endLocation?]
  const locations: Location[] = [startLocation, ...parks.map((p) => ({ lat: p.lat, lon: p.lon }))];
  const endIdx = endLocation ? locations.length : null;
  if (endLocation) locations.push(endLocation);

  const { distMatrix, durationMatrix, haversineMatrix } = buildMatrices(locations, drivingMatrix);

  // Phase 1: Greedy earliest-game ordering
  const { order: nnOrder, infeasible: nnInfeasible } = greedyEarliestGameOrder(
    parks,
    startLocation,
    startDate,
    distMatrix,
    durationMatrix,
    haversineMatrix,
    gamesByPark
  );

  // Phase 2: 2-opt improvement on geographic ordering
  const improvedOrder = twoOptImprove(nnOrder, distMatrix, 0, endIdx, 500);

  // Phase 3: Re-assign games to the improved ordering
  const reorderedParks = improvedOrder.map((i) => parks[i]);
  const { stops, infeasible: assignInfeasible } = assignGames(
    reorderedParks,
    parks,
    startLocation,
    startDate,
    gamesByPark,
    distMatrix,
    durationMatrix,
    haversineMatrix,
    travelMode,
  );

  // Combine infeasible parks from both phases
  const infeasibleSet = new Set([
    ...nnInfeasible.map((i: number) => parks[i].abbr),
    ...assignInfeasible,
  ]);

  // Calculate totals
  const totalDistanceMiles = stops.reduce((sum, s) => sum + s.distanceFromPrevious, 0);

  // Add distance to end location if specified
  let endDistance = 0;
  if (endLocation && stops.length > 0) {
    const lastStop = stops[stops.length - 1];
    const lastIdx = parks.findIndex((p) => p.abbr === lastStop.park.abbr) + 1;
    endDistance = Math.round(distMatrix[lastIdx][endIdx!]);
  }

  // Estimated days: from start_date to last game date
  let estimatedDays = 0;
  if (stops.length > 0) {
    const firstMs = new Date(startDate).getTime();
    const lastMs = new Date(stops[stops.length - 1].game.date_time).getTime();
    estimatedDays = Math.ceil((lastMs - firstMs) / (24 * 3600_000));
  }

  // Build segment modes: one per leg between consecutive stops
  // Use haversine distance for car/air classification
  const segmentModes: string[] = [];
  if (stops.length > 0) {
    // start → first stop: use haversine for mode classification
    const firstParkIdx = parks.findIndex((p) => p.abbr === stops[0].park.abbr) + 1;
    const startHaversine = haversineMatrix[0][firstParkIdx];
    segmentModes.push(getTravelMode(startHaversine, travelMode));
  }
  for (let i = 1; i < stops.length; i++) {
    segmentModes.push(stops[i].travelMode);
  }
  if (endLocation && stops.length > 0) {
    const lastStop = stops[stops.length - 1];
    const lastHaversine = haversine(lastStop.park.lat, lastStop.park.lon, endLocation.lat, endLocation.lon);
    segmentModes.push(getTravelMode(lastHaversine, travelMode));
  }

  return {
    stops,
    totalDistanceMiles: totalDistanceMiles + endDistance,
    estimatedDays,
    infeasibleParks: [...infeasibleSet],
    segmentModes,
  };
}
