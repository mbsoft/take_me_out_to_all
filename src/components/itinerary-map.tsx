"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface MapGame {
  game_id: number;
  home_team: string;
  away_team: string;
  stadium_name?: string;
  city?: string;
  date_time: string;
  lat?: number;
  lon?: number;
}

interface ItineraryMapProps {
  games: MapGame[];
  startLocation?: { lat: number; lon: number } | null;
  endLocation?: { lat: number; lon: number } | null;
  travelMode: string;
  allTeams?: Array<{ abbr: string; lat: number; lon: number; stadium_name: string }>;
  visitedParks?: Set<string>;
}

// Decode polyline6 encoded string
function decodePolyline6(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e6, lat / 1e6]); // [lng, lat] for GeoJSON
  }
  return coords;
}

export default function ItineraryMap({
  games,
  startLocation,
  endLocation,
  travelMode,
  allTeams,
  visitedParks,
}: ItineraryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [nbLoaded, setNbLoaded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    totalDistance: number;
    totalDuration: number;
  } | null>(null);

  // Dynamically import nbmap-gl (client only)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Load CSS via link tag
        if (!document.getElementById("nbmap-css")) {
          const link = document.createElement("link");
          link.id = "nbmap-css";
          link.rel = "stylesheet";
          link.href = "https://maps-gl.nextbillion.io/maps/v2/api/css";
          document.head.appendChild(link);
        }
        const nb = await import("@nbai/nbmap-gl");
        const nextbillion = nb.default;
        if (!cancelled) {
          nextbillion.setApiKey(process.env.NEXT_PUBLIC_NBAI_API_KEY!);
          (window as any).__nb = nextbillion;
          (window as any).__NBMap = nb.NBMap;
          (window as any).__Marker = nb.Marker;
          (window as any).__Popup = nb.Popup;
          setNbLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load nbmap-gl:", err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!nbLoaded || !mapContainer.current || mapRef.current) return;
    const NBMap = (window as any).__NBMap;
    const nbmap = new NBMap({
      container: mapContainer.current,
      style: "https://api.nextbillion.io/maps/streets/style.json",
      zoom: 3.5,
      center: { lat: 39.8283, lng: -98.5795 }, // center of US
    });
    mapRef.current = nbmap;

    return () => {
      if (mapRef.current) {
        mapRef.current.map?.remove();
        mapRef.current = null;
      }
    };
  }, [nbLoaded]);

  // Render markers + route
  const renderMap = useCallback(async () => {
    const nbmap = mapRef.current;
    if (!nbmap || !nbmap.map) return;
    const map = nbmap.map;
    const Marker = (window as any).__Marker;
    const Popup = (window as any).__Popup;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Remove old route layers/sources
    if (map.getLayer("route-line")) map.removeLayer("route-line");
    if (map.getSource("route")) map.removeSource("route");
    if (map.getLayer("flight-line")) map.removeLayer("flight-line");
    if (map.getSource("flights")) map.removeSource("flights");

    // Show all target parks as gray pins when no games added
    if (allTeams && games.length === 0) {
      allTeams.forEach((t) => {
        const el = document.createElement("div");
        el.className = "nb-marker-gray";
        el.style.cssText =
          "width:12px;height:12px;border-radius:50%;background:#9ca3af;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);";
        const popup = new Popup({ offset: 10, closeButton: false }).setText(
          t.stadium_name
        );
        const marker = new Marker({ element: el })
          .setLngLat({ lng: t.lon, lat: t.lat })
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
      });
      return;
    }

    // Add numbered markers for itinerary games
    const bounds: [number, number, number, number] = [180, 90, -180, -90]; // minLng, minLat, maxLng, maxLat

    games.forEach((g, i) => {
      if (!g.lat || !g.lon) return;
      const el = document.createElement("div");
      const isVisited = visitedParks?.has(g.home_team);
      el.style.cssText = `
        width:28px;height:28px;border-radius:50%;
        background:${isVisited ? "#16a34a" : "#2563eb"};
        color:#fff;font-size:12px;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
        cursor:pointer;
      `;
      el.textContent = String(i + 1);

      const popup = new Popup({ offset: 15, closeButton: false }).setHTML(
        `<div style="font-size:13px;line-height:1.4">
          <strong>${g.away_team} @ ${g.home_team}</strong><br/>
          ${g.stadium_name || ""}, ${g.city || ""}<br/>
          ${new Date(g.date_time).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </div>`
      );

      const marker = new Marker({ element: el })
        .setLngLat({ lng: g.lon, lat: g.lat })
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);

      bounds[0] = Math.min(bounds[0], g.lon);
      bounds[1] = Math.min(bounds[1], g.lat);
      bounds[2] = Math.max(bounds[2], g.lon);
      bounds[3] = Math.max(bounds[3], g.lat);
    });

    // Fit bounds
    if (games.length > 0 && games[0].lat) {
      map.fitBounds(
        [
          [bounds[0] - 1, bounds[1] - 1],
          [bounds[2] + 1, bounds[3] + 1],
        ],
        { padding: 40, maxZoom: 10, duration: 500 }
      );
    }

    // Fetch directions for route polyline
    if (games.length >= 2) {
      const waypoints = games
        .filter((g) => g.lat && g.lon)
        .map((g) => ({ lat: g.lat!, lon: g.lon! }));

      if (startLocation) waypoints.unshift(startLocation);
      if (endLocation) waypoints.push(endLocation);

      try {
        const res = await fetch("/api/directions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ waypoints }),
        });
        const data = await res.json();

        if (data.geometries && data.geometries.length > 0) {
          // Decode and combine all geometry chunks
          const allCoords: [number, number][] = [];
          for (const geom of data.geometries) {
            allCoords.push(...decodePolyline6(geom));
          }

          if (allCoords.length > 0) {
            map.addSource("route", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: allCoords },
              },
            });
            map.addLayer({
              id: "route-line",
              type: "line",
              source: "route",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": "#2563eb",
                "line-width": 4,
                "line-opacity": 0.7,
              },
            });
          }

          setRouteInfo({
            totalDistance: data.totalDistance,
            totalDuration: data.totalDuration,
          });
        }
      } catch (err) {
        console.error("Failed to fetch directions:", err);
        // Fallback: draw straight lines between points
        drawStraightLines(map, games);
      }
    }
  }, [games, startLocation, endLocation, travelMode, allTeams, visitedParks]);

  // Wait for map load then render
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.map;
    if (!map) return;

    if (map.loaded()) {
      renderMap();
    } else {
      map.on("load", renderMap);
    }

    return () => {
      map.off?.("load", renderMap);
    };
  }, [renderMap, nbLoaded]);

  return (
    <div className="relative">
      <div ref={mapContainer} className="w-full h-[450px] rounded-lg border" />
      {routeInfo && (
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur rounded-md px-3 py-2 text-xs shadow">
          <span className="font-medium">
            {Math.round(routeInfo.totalDistance / 1609.34).toLocaleString()} mi
          </span>
          <span className="mx-2 text-muted-foreground">&middot;</span>
          <span className="text-muted-foreground">
            ~{Math.round(routeInfo.totalDuration / 3600)} hrs driving
          </span>
        </div>
      )}
    </div>
  );
}

function drawStraightLines(map: any, games: MapGame[]) {
  const coords = games
    .filter((g) => g.lat && g.lon)
    .map((g) => [g.lon!, g.lat!] as [number, number]);

  if (coords.length < 2) return;

  map.addSource("route", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    },
  });
  map.addLayer({
    id: "route-line",
    type: "line",
    source: "route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#2563eb",
      "line-width": 3,
      "line-opacity": 0.5,
      "line-dasharray": [2, 2],
    },
  });
}
