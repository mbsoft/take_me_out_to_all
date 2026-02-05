/**
 * NB.ai Route Optimization API v2 client.
 * Replaces the custom greedy/2-opt optimizer with NB.ai's VRP solver.
 *
 * Each MLB team is modeled as a "job" with time_windows for every home game.
 * A single vehicle represents the user's trip.
 */

import { haversine } from "./haversine";
import { logApiCall } from "./api-logger";
import type { Park, ScheduledGame, RouteStop, OptimizedRoute } from "./route-optimizer";

// --- NB.ai API types ---

interface NBJob {
  id: number;
  location_index: number;
  service: number;
  time_windows: number[][];
  description: string;
}

interface NBVehicle {
  id: number;
  start_index: number;
  end_index?: number;
  time_window: [number, number];
  capacity: number[];
}

interface NBOptimizationRequest {
  description?: string;
  locations: {
    id: number;
    location: string[]; // array of "lat,lon" strings
  };
  jobs: NBJob[];
  vehicles: NBVehicle[];
  options: { routing: { mode: string }; objective: { travel_cost: string } };
}

interface NBStep {
  type: string;
  arrival: number;
  duration: number;
  service: number;
  waiting_time: number;
  location: number[];
  location_index: number;
  id?: number;
  distance: number;
}

interface NBRoute {
  vehicle: number;
  cost: number;
  steps: NBStep[];
  distance: number;
  duration: number;
  service: number;
  waiting_time: number;
}

interface NBUnassigned {
  id: number;
  type: string;
  location: number[];
  description?: string;
}

interface NBResultResponse {
  status: string;
  message: string;
  result?: {
    code: number;
    summary: {
      cost: number;
      routes: number;
      unassigned: number;
      distance: number;
      duration: number;
    };
    routes: NBRoute[];
    unassigned?: NBUnassigned[];
  };
}

interface Location {
  lat: number;
  lon: number;
}

interface JobGameMapping {
  park: Park;
  games: ScheduledGame[];
}

const METERS_TO_MILES = 0.000621371;
const DRIVE_THRESHOLD_MILES = 500;
const GAME_SERVICE_SECONDS = 86400; // 24 hours
const PRE_GAME_WINDOW_HOURS = 3;

// --- Request Building ---

export function buildOptimizationRequest(
  startLocation: Location,
  endLocation: Location | null,
  startDate: string,
  endDate: string | null,
  parks: Park[],
  gamesByPark: Map<string, ScheduledGame[]>,
  description?: string,
): { request: NBOptimizationRequest; jobGameMap: Map<number, JobGameMapping> } {
  // Build locations: pipe-separated "lat,lon|lat,lon|..." string
  const locationParts: string[] = [];

  // Index 0: start location
  locationParts.push(`${startLocation.lat},${startLocation.lon}`);

  // Indices 1..N: parks
  for (let i = 0; i < parks.length; i++) {
    locationParts.push(`${parks[i].lat},${parks[i].lon}`);
  }

  // Optional end location
  if (endLocation) {
    locationParts.push(`${endLocation.lat},${endLocation.lon}`);
  }



  // Build jobs: one per team with time_windows for each home game
  const jobs: NBJob[] = [];
  const jobGameMap = new Map<number, JobGameMapping>();
  let jobId = 1;

  for (let i = 0; i < parks.length; i++) {
    const park = parks[i];
    const games = gamesByPark.get(park.abbr) || [];
    if (games.length === 0) continue;

    const sortedGames = [...games].sort(
      (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
    );

    // Build raw windows then merge overlapping ones
    // NB.ai requires non-overlapping, sorted time_windows
    const rawWindows = sortedGames.map((game) => {
      const gameEpoch = Math.floor(new Date(game.date_time).getTime() / 1000);
      const windowStart = gameEpoch - PRE_GAME_WINDOW_HOURS * 3600;
      return [windowStart, gameEpoch];
    });

    const timeWindows: number[][] = [];
    for (const w of rawWindows) {
      if (timeWindows.length > 0 && w[0] <= timeWindows[timeWindows.length - 1][1]) {
        // Overlaps with previous — extend the end
        timeWindows[timeWindows.length - 1][1] = Math.max(timeWindows[timeWindows.length - 1][1], w[1]);
      } else {
        timeWindows.push([...w]);
      }
    }

    jobs.push({
      id: jobId,
      location_index: i + 1,
      service: GAME_SERVICE_SECONDS,
      time_windows: timeWindows,
      description: park.abbr,
    });

    jobGameMap.set(jobId, { park, games: sortedGames });
    jobId++;
  }

  // Build vehicle
  const shiftStartEpoch = Math.floor(new Date(startDate).getTime() / 1000);
  const shiftEndEpoch = endDate
    ? Math.floor(new Date(endDate).getTime() / 1000) + 86400 // end of that day
    : shiftStartEpoch + 180 * 86400; // 6 months default

  const vehicle: NBVehicle = {
    id: 1,
    start_index: 0,
    time_window: [shiftStartEpoch, shiftEndEpoch],
    capacity: [parks.length],
  };
  if (endLocation) {
    vehicle.end_index = parks.length + 1;
  }

  const request: NBOptimizationRequest = {
    ...(description ? { description } : {}),
    locations: {
      id: 1,
      location: locationParts,
    },
    jobs,
    vehicles: [vehicle],
    options: { routing: { mode: "car" }, objective: { travel_cost: "distance" } },
  };

  return { request, jobGameMap };
}

// --- API Interaction ---

function getApiKey(): string {
  const key = process.env.NBAI_API_KEY || process.env.NEXT_PUBLIC_NBAI_API_KEY;
  if (!key) throw new Error("NBAI_API_KEY not configured");
  return key;
}

export async function submitOptimization(request: NBOptimizationRequest): Promise<string> {
  const apiKey = getApiKey();
  const url = `https://api.nextbillion.io/optimization/v2?key=${apiKey}`;

  console.log(`[NB.ai Optimizer] Submitting optimization: ${request.jobs.length} jobs, ${request.locations.location.length} locations`);

  const fetchStart = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  logApiCall({
    api_name: "nbai_optimization",
    endpoint: "/optimization/v2",
    method: "POST",
    status_code: res.status,
    response_time_ms: Date.now() - fetchStart,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NB.ai optimization POST failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!data.id) {
    throw new Error(`NB.ai optimization POST returned no task ID: ${JSON.stringify(data)}`);
  }

  console.log(`[NB.ai Optimizer] Submitted task: ${data.id}`);
  return data.id as string;
}

export async function pollForResult(
  taskId: string,
  maxWaitMs: number = 600_000,
  pollIntervalMs: number = 5_000,
): Promise<NBResultResponse> {
  const apiKey = getApiKey();
  const url = `https://api.nextbillion.io/optimization/v2/result?id=${taskId}&key=${apiKey}`;
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < maxWaitMs) {
    attempt++;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`NB.ai optimization GET failed ${res.status}: ${text}`);
    }

    const data: NBResultResponse = await res.json();
    console.log(`[NB.ai Optimizer] Poll attempt ${attempt}: status=${data.status}, message=${data.message}`);

    // Result is truly complete when it has routes (not just an empty {} placeholder)
    if (data.status === "Ok" && data.result?.summary) {
      console.log(
        `[NB.ai Optimizer] Complete: ${data.result.summary.routes} routes, ` +
        `${data.result.summary.unassigned} unassigned, ` +
        `${Math.round(data.result.summary.distance * METERS_TO_MILES)} miles`,
      );
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`NB.ai optimization timed out after ${maxWaitMs / 1000}s`);
}

// --- Result Parsing ---

function identifySelectedGame(
  serviceStartEpoch: number,
  games: ScheduledGame[],
): ScheduledGame {
  // Match service start time against the same time windows sent to NB.ai:
  // [gameEpoch - PRE_GAME_WINDOW_HOURS * 3600, gameEpoch]
  for (const game of games) {
    const gameEpoch = Math.floor(new Date(game.date_time).getTime() / 1000);
    const windowStart = gameEpoch - PRE_GAME_WINDOW_HOURS * 3600;
    if (serviceStartEpoch >= windowStart && serviceStartEpoch <= gameEpoch) {
      return game;
    }
  }

  // Fallback: pick nearest game by epoch proximity
  let bestGame = games[0];
  let bestDiff = Infinity;
  for (const game of games) {
    const gameEpoch = Math.floor(new Date(game.date_time).getTime() / 1000);
    const diff = Math.abs(serviceStartEpoch - gameEpoch);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestGame = game;
    }
  }
  return bestGame;
}

export function parseOptimizationResult(
  result: NBResultResponse,
  jobGameMap: Map<number, JobGameMapping>,
  startDate: string,
  parks: Park[],
): OptimizedRoute {
  if (!result.result || result.result.routes.length === 0) {
    return { stops: [], totalDistanceMiles: 0, estimatedDays: 0, infeasibleParks: [], segmentModes: [] };
  }

  const route = result.result.routes[0]; // single vehicle = single route
  const stops: RouteStop[] = [];
  const segmentModes: string[] = [];
  const assignedJobIds = new Set<number>();

  let previousEpoch = Math.floor(new Date(startDate).getTime() / 1000);
  let previousLat = 0;
  let previousLon = 0;

  // Get start location from the first step
  const startStep = route.steps.find((s) => s.type === "start");
  if (startStep) {
    previousLat = startStep.location[0];
    previousLon = startStep.location[1];
  }

  for (const step of route.steps) {
    if (step.type !== "job" || step.id == null) continue;

    const jobEntry = jobGameMap.get(step.id);
    if (!jobEntry) continue;

    assignedJobIds.add(step.id);
    const game = identifySelectedGame(step.arrival + step.waiting_time, jobEntry.games);
    const distanceMiles = Math.round(step.distance * METERS_TO_MILES);

    // Classify car vs air using haversine between previous and current location
    const hDist = haversine(previousLat, previousLon, jobEntry.park.lat, jobEntry.park.lon);
    const travelMode: "car" | "air" = hDist >= DRIVE_THRESHOLD_MILES ? "air" : "car";

    const gapHours = Math.round((step.arrival - previousEpoch) / 3600);

    stops.push({
      park: jobEntry.park,
      game,
      distanceFromPrevious: distanceMiles,
      travelMode,
      gapHours,
    });

    segmentModes.push(travelMode);
    previousEpoch = step.arrival + step.service;
    previousLat = jobEntry.park.lat;
    previousLon = jobEntry.park.lon;
  }

  // Add end segment mode if there's an end step
  const endStep = route.steps.find((s) => s.type === "end");
  if (endStep && stops.length > 0) {
    const lastPark = stops[stops.length - 1].park;
    const endHDist = haversine(lastPark.lat, lastPark.lon, endStep.location[0], endStep.location[1]);
    segmentModes.push(endHDist >= DRIVE_THRESHOLD_MILES ? "air" : "car");
  }

  // Identify infeasible parks
  const infeasibleParks: string[] = [];
  for (const [jobId, entry] of jobGameMap.entries()) {
    if (!assignedJobIds.has(jobId)) {
      infeasibleParks.push(entry.park.abbr);
    }
  }
  // Also check NB.ai's explicit unassigned list
  if (result.result.unassigned) {
    for (const unassigned of result.result.unassigned) {
      const entry = jobGameMap.get(unassigned.id);
      if (entry && !infeasibleParks.includes(entry.park.abbr)) {
        infeasibleParks.push(entry.park.abbr);
      }
    }
  }

  // Calculate totals
  const totalDistanceMiles = Math.round(result.result.summary.distance * METERS_TO_MILES);

  let estimatedDays = 0;
  if (stops.length > 0) {
    const firstMs = new Date(startDate).getTime();
    const lastMs = new Date(stops[stops.length - 1].game.date_time).getTime();
    estimatedDays = Math.ceil((lastMs - firstMs) / (24 * 3600_000));
  }

  return {
    stops,
    totalDistanceMiles,
    estimatedDays,
    infeasibleParks,
    segmentModes,
  };
}

// --- Main Entry Point ---

export async function optimizeRouteWithNB(
  startLocation: Location,
  endLocation: Location | null,
  startDate: string,
  endDate: string | null,
  parks: Park[],
  gamesByPark: Map<string, ScheduledGame[]>,
  description?: string,
): Promise<OptimizedRoute> {
  const { request, jobGameMap } = buildOptimizationRequest(
    startLocation,
    endLocation,
    startDate,
    endDate,
    parks,
    gamesByPark,
    description,
  );

  if (request.jobs.length === 0) {
    return { stops: [], totalDistanceMiles: 0, estimatedDays: 0, infeasibleParks: [], segmentModes: [] };
  }

  const taskId = await submitOptimization(request);
  const result = await pollForResult(taskId);

  if (result.result?.code !== 0) {
    throw new Error(`NB.ai optimization returned error code: ${result.result?.code}`);
  }

  return parseOptimizationResult(result, jobGameMap, startDate, parks);
}
