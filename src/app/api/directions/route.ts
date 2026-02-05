import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logApiCall } from "@/lib/api-logger";
import crypto from "crypto";

const NBAI_API_KEY = process.env.NBAI_API_KEY || process.env.NEXT_PUBLIC_NBAI_API_KEY;

interface Waypoint {
  lat: number;
  lon: number;
}

/** Generate a hash of the route inputs for cache validation */
function generateRouteHash(waypoints: Waypoint[], segmentModes: string[]): string {
  const input = JSON.stringify({
    waypoints: waypoints.map(w => ({ lat: w.lat.toFixed(5), lon: w.lon.toFixed(5) })),
    modes: segmentModes,
  });
  return crypto.createHash("md5").update(input).digest("hex");
}

/** Encode one signed value for polyline6 (left-shift then chunk; negative = invert). */
function encodePolylineValue(value: number): string {
  let v = (value << 1) ^ (value < 0 ? -1 : 0);
  let result = "";
  for (;;) {
    const byte = v & 0x1f;
    v = v >>> 5;
    if (v !== 0) {
      result += String.fromCharCode((byte | 0x20) + 63);
    } else {
      result += String.fromCharCode(byte + 63);
      break;
    }
  }
  return result;
}

/** Points along a great-circle arc between two lat/lon points (for flight segments). */
function greatCircleArc(from: Waypoint, to: Waypoint, numPoints = 24): Waypoint[] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(from.lat);
  const lon1 = toRad(from.lon);
  const lat2 = toRad(to.lat);
  const lon2 = toRad(to.lon);
  const x1 = Math.cos(lat1) * Math.cos(lon1);
  const y1 = Math.cos(lat1) * Math.sin(lon1);
  const z1 = Math.sin(lat1);
  const x2 = Math.cos(lat2) * Math.cos(lon2);
  const y2 = Math.cos(lat2) * Math.sin(lon2);
  const z2 = Math.sin(lat2);
  const dot = x1 * x2 + y1 * y2 + z1 * z2;
  const omega = Math.acos(Math.max(-1, Math.min(1, dot)));
  if (omega < 1e-6) return [from, to];
  const points: Waypoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const a = Math.sin((1 - t) * omega) / Math.sin(omega);
    const b = Math.sin(t * omega) / Math.sin(omega);
    const x = a * x1 + b * x2;
    const y = a * y1 + b * y2;
    const z = a * z1 + b * z2;
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lon = toDeg(Math.atan2(y, x));
    points.push({ lat, lon });
  }
  return points;
}

/**
 * Exaggerate arc curvature so short-distance flights look more like an arc on the map.
 * Scales each point's deviation from the chord; scale is larger for shorter distances.
 */
function exaggeratedArc(from: Waypoint, to: Waypoint, numPoints = 24): Waypoint[] {
  const arc = greatCircleArc(from, to, numPoints);
  const distKm = haversineMeters(from, to) / 1000;
  if (distKm < 1) return arc;
  // Scale factor: larger for shorter distances (e.g. 50/sqrt(100)=5 at 100km, 1 at 2500km)
  const scale = Math.min(10, Math.max(1, 50 / Math.sqrt(distKm)));
  const result: Waypoint[] = [arc[0]!];
  for (let i = 1; i < arc.length - 1; i++) {
    const t = i / (arc.length - 1);
    const chord = {
      lat: (1 - t) * from.lat + t * to.lat,
      lon: (1 - t) * from.lon + t * to.lon,
    };
    const p = arc[i]!;
    result.push({
      lat: chord.lat + scale * (p.lat - chord.lat),
      lon: chord.lon + scale * (p.lon - chord.lon),
    });
  }
  result.push(arc[arc.length - 1]!);
  return result;
}

/** Encode an array of points as polyline6 (first point absolute, then deltas). */
function encodePolyline6Points(points: Waypoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const lat = Math.round(points[0]!.lat * 1e6);
    const lng = Math.round(points[0]!.lon * 1e6);
    return encodePolylineValue(lat) + encodePolylineValue(lng);
  }
  let out = "";
  let prevLat = Math.round(points[0]!.lat * 1e6);
  let prevLng = Math.round(points[0]!.lon * 1e6);
  out += encodePolylineValue(prevLat) + encodePolylineValue(prevLng);
  for (let i = 1; i < points.length; i++) {
    const lat = Math.round(points[i]!.lat * 1e6);
    const lng = Math.round(points[i]!.lon * 1e6);
    out += encodePolylineValue(lat - prevLat) + encodePolylineValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

/** Haversine distance in meters (approx). */
function haversineMeters(a: Waypoint, b: Waypoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!NBAI_API_KEY) {
    return NextResponse.json({ error: "Directions API key not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  const { waypoints, segment_modes: segmentModes, itineraryId } = body as {
    waypoints: Waypoint[];
    segment_modes?: string[];
    itineraryId?: string;
  };
  if (!waypoints || waypoints.length < 2) {
    return NextResponse.json({ error: "At least 2 waypoints required" }, { status: 400 });
  }

  // Normalize segment modes array
  const numSegments = waypoints.length - 1;
  const normalizedModes = [...(Array.isArray(segmentModes) ? segmentModes : [])];
  while (normalizedModes.length < numSegments) normalizedModes.push("car");

  // Generate hash of current route inputs for cache validation
  const currentRouteHash = generateRouteHash(waypoints, normalizedModes);

  // Check for cached route geometry
  if (itineraryId) {
    const { data: itinerary } = await db
      .from("itineraries")
      .select("route_geometry")
      .eq("id", itineraryId)
      .eq("user_id", session.user.id)
      .single();

    if (itinerary?.route_geometry) {
      try {
        const cached = JSON.parse(itinerary.route_geometry);
        // Only use cache if the route hash matches (same waypoints + modes)
        if (cached.routeHash === currentRouteHash) {
          console.log("Using cached directions for itinerary:", itineraryId);
          return NextResponse.json({
            geometries: cached.geometries || [],
            legs: cached.legs || [],
            totalDistance: cached.totalDistance || 0,
            totalDuration: cached.totalDuration || 0,
            drivingDistance: cached.drivingDistance ?? cached.totalDistance ?? 0,
            drivingDuration: cached.drivingDuration ?? cached.totalDuration ?? 0,
            airDistance: cached.airDistance ?? 0,
            airDuration: cached.airDuration ?? 0,
            cached: true,
          });
        } else {
          console.log("Route hash mismatch, fetching fresh directions");
        }
      } catch (err) {
        console.warn("Failed to parse cached geometry, fetching fresh:", err);
      }
    }
  }

  const allLegs: Array<{ distance: number; duration: number; mode: "car" | "air" }> = [];
  const allGeometries: string[] = [];

  // Process each segment with its mode
  for (let i = 0; i < numSegments; i++) {
    const from = waypoints[i]!;
    const to = waypoints[i + 1]!;
    const mode = (normalizedModes[i] ?? "car") === "air" ? "air" : "car";
    
    if (mode === "air") {
      const arcPoints = exaggeratedArc(from, to, 24);
      allGeometries.push(encodePolyline6Points(arcPoints));
      const dist = haversineMeters(from, to);
      allLegs.push({ distance: dist, duration: Math.round(dist / 200), mode: "air" }); // ~200 m/s flight
    } else {
      const origin = `${from.lat},${from.lon}`;
      const destination = `${to.lat},${to.lon}`;
      const url = new URL("https://api.nextbillion.io/directions/json");
      url.searchParams.set("key", NBAI_API_KEY);
      try {
        const fetchStart = Date.now();
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin,
            destination,
            mode: "car",
            overview: "full",
            geometry: "polyline6",
          }),
          next: { revalidate: 3600 },
        } as RequestInit);
        logApiCall({
          api_name: "nbai_directions",
          endpoint: "/directions/json",
          method: "POST",
          status_code: res.status,
          response_time_ms: Date.now() - fetchStart,
          user_id: session.user.id,
        });
        if (!res.ok) {
          console.error(`Directions API error: ${res.status}`);
          continue;
        }
        const data = await res.json();
        if (data.routes?.[0]) {
          const route = data.routes[0];
          const geometry = route.geometry || route.overview?.geometry;
          if (typeof geometry === "string") {
            allGeometries.push(geometry);
          }
          if (route.legs) {
            for (const leg of route.legs) {
              allLegs.push({
                distance: leg.distance?.value ?? leg.distance ?? 0,
                duration: leg.duration?.value ?? leg.duration ?? 0,
                mode: "car",
              });
            }
          }
        }
      } catch (err) {
        console.error("NB.ai Directions API error:", err);
      }
    }
  }

  let drivingDistance = 0;
  let drivingDuration = 0;
  let airDistance = 0;
  let airDuration = 0;
  for (const leg of allLegs) {
    if (leg.mode === "air") {
      airDistance += leg.distance;
      airDuration += leg.duration;
    } else {
      drivingDistance += leg.distance;
      drivingDuration += leg.duration;
    }
  }

  const result = {
    geometries: allGeometries,
    legs: allLegs,
    totalDistance: allLegs.reduce((s, l) => s + l.distance, 0),
    totalDuration: allLegs.reduce((s, l) => s + l.duration, 0),
    drivingDistance,
    drivingDuration,
    airDistance,
    airDuration,
  };

  // Cache the result with route hash if itineraryId is provided
  if (itineraryId) {
    const cacheData = { ...result, routeHash: currentRouteHash };
    await db
      .from("itineraries")
      .update({ route_geometry: JSON.stringify(cacheData) })
      .eq("id", itineraryId)
      .eq("user_id", session.user.id);
    console.log("Cached directions for itinerary:", itineraryId, "hash:", currentRouteHash);
  }

  return NextResponse.json(result);
}
