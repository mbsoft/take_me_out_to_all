import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const NBAI_API_KEY = process.env.NEXT_PUBLIC_NBAI_API_KEY;

interface Waypoint {
  lat: number;
  lon: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { waypoints } = (await req.json()) as { waypoints: Waypoint[] };
  if (!waypoints || waypoints.length < 2) {
    return NextResponse.json({ error: "At least 2 waypoints required" }, { status: 400 });
  }

  // NB.ai Directions API supports up to 25 waypoints per request.
  // For longer itineraries, chunk into sequential calls and stitch.
  const MAX_WAYPOINTS = 25;
  const allLegs: Array<{ distance: number; duration: number }> = [];
  const allGeometries: string[] = [];

  for (let i = 0; i < waypoints.length - 1; i += MAX_WAYPOINTS - 1) {
    const chunk = waypoints.slice(i, i + MAX_WAYPOINTS);
    if (chunk.length < 2) break;

    const origin = `${chunk[0].lat},${chunk[0].lon}`;
    const destination = `${chunk[chunk.length - 1].lat},${chunk[chunk.length - 1].lon}`;
    const intermediates = chunk.slice(1, -1).map((w) => `${w.lat},${w.lon}`).join("|");

    const params = new URLSearchParams({
      origin,
      destination,
      mode: "car",
      key: NBAI_API_KEY!,
      overview: "full",
      geometry: "polyline6",
    });
    if (intermediates) {
      params.set("waypoints", intermediates);
    }

    try {
      const res = await fetch(
        `https://api.nextbillion.io/directions/json?${params}`,
        { next: { revalidate: 3600 } } // cache for 1hr
      );
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        allGeometries.push(route.geometry);
        if (route.legs) {
          for (const leg of route.legs) {
            allLegs.push({
              distance: leg.distance?.value ?? leg.distance ?? 0,
              duration: leg.duration?.value ?? leg.duration ?? 0,
            });
          }
        }
      }
    } catch (err) {
      console.error("NB.ai Directions API error:", err);
    }
  }

  return NextResponse.json({
    geometries: allGeometries,
    legs: allLegs,
    totalDistance: allLegs.reduce((s, l) => s + l.distance, 0),
    totalDuration: allLegs.reduce((s, l) => s + l.duration, 0),
  });
}
