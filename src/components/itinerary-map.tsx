"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getTeamLogoPath } from "@/lib/team-logos";
import { ChevronLeft, ChevronRight, Car, Plane, MapPin, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StadiumViewer } from "@/components/stadium-viewer";
import { useTheme } from "@/components/theme-provider";
import type maplibregl from "maplibre-gl";

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

interface MapStopover {
  after_index: number;
  lat: number;
  lon: number;
  sort_order: number;
}

interface ItineraryMapProps {
  games: MapGame[];
  stopovers?: MapStopover[];
  segmentModes?: string[];
  startLocation?: { lat: number; lon: number } | null;
  endLocation?: { lat: number; lon: number } | null;
  travelMode: string;
  allTeams?: Array<{ abbr: string; lat: number; lon: number; stadium_name: string }>;
  /** All 30 ballparks to show small team logos on the map */
  allBallparks?: Array<{ abbr: string; lat: number; lon: number; stadium_name: string }>;
  visitedParks?: Set<string>;
  itineraryId?: string;
}

/** Ballparks that do not have a 3D model; do not open stadium viewer for these. (ATH = Athletics) */
const BALLPARKS_WITHOUT_3D_MODEL = new Set(["ATH"]);

/** MLB team timezone offsets from UTC (standard time, adjust for DST) */
const TEAM_TIMEZONES: Record<string, string> = {
  ARI: "America/Phoenix",      // Arizona (no DST)
  ATH: "America/Los_Angeles",  // Oakland
  ATL: "America/New_York",     // Atlanta
  BAL: "America/New_York",     // Baltimore
  BOS: "America/New_York",     // Boston
  CHC: "America/Chicago",      // Chicago Cubs
  CHW: "America/Chicago",      // Chicago White Sox
  CIN: "America/New_York",     // Cincinnati
  CLE: "America/New_York",     // Cleveland
  COL: "America/Denver",       // Colorado
  DET: "America/New_York",     // Detroit
  HOU: "America/Chicago",      // Houston
  KC: "America/Chicago",       // Kansas City
  LAA: "America/Los_Angeles",  // LA Angels
  LAD: "America/Los_Angeles",  // LA Dodgers
  MIA: "America/New_York",     // Miami
  MIL: "America/Chicago",      // Milwaukee
  MIN: "America/Chicago",      // Minnesota
  NYM: "America/New_York",     // NY Mets
  NYY: "America/New_York",     // NY Yankees
  PHI: "America/New_York",     // Philadelphia
  PIT: "America/New_York",     // Pittsburgh
  SD: "America/Los_Angeles",   // San Diego
  SEA: "America/Los_Angeles",  // Seattle
  SF: "America/Los_Angeles",   // San Francisco
  STL: "America/Chicago",      // St. Louis
  TB: "America/New_York",      // Tampa Bay
  TEX: "America/Chicago",      // Texas
  TOR: "America/New_York",     // Toronto
  WSH: "America/New_York",     // Washington
};

/** Bearing in degrees from point A to B (0 = north, 90 = east). Coords are [lng, lat]. */
function bearingDeg(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  let deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Format a date-time string in the venue's local timezone */
function formatLocalTime(dateTimeStr: string, homeTeam: string): string {
  try {
    const date = new Date(dateTimeStr);
    const timezone = TEAM_TIMEZONES[homeTeam] || "America/New_York";

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    });
  } catch {
    return "";
  }
}

/** Format a date string in the venue's local timezone */
function formatLocalDate(dateTimeStr: string, homeTeam: string): string {
  try {
    const date = new Date(dateTimeStr);
    const timezone = TEAM_TIMEZONES[homeTeam] || "America/New_York";

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: timezone,
    });
  } catch {
    return "";
  }
}

/** Create a DOM element with an airplane icon (SVG) for use as a map marker. */
function createAirplaneElement(): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:28px;height:28px;pointer-events:none;";
  wrap.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#2563eb" stroke="#1d4ed8" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
  `;
  return wrap;
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
  stopovers = [],
  segmentModes = [],
  startLocation,
  endLocation,
  travelMode,
  allTeams,
  allBallparks,
  visitedParks,
  itineraryId,
}: ItineraryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: maplibregl.Map } | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const airplaneMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    totalDistance: number;
    totalDuration: number;
    drivingDistance: number;
    drivingDuration: number;
    airDistance: number;
    airDuration: number;
  } | null>(null);
  const [selectedBallpark, setSelectedBallpark] = useState<{
    abbr: string;
    stadium_name: string;
  } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const { theme } = useTheme();
  const appliedThemeRef = useRef<string | null>(null);

  // Load SDK, init map, and signal ready — all in one effect to avoid race conditions
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Load CSS
        if (!document.getElementById("maplibre-css")) {
          const link = document.createElement("link");
          link.id = "maplibre-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
          document.head.appendChild(link);
        }

        const maplibregl = await import("maplibre-gl");
        if (cancelled || !mapContainer.current) return;

        // Store constructors on window for use in renderMap
        (window as any).__Marker = maplibregl.Marker;
        (window as any).__Popup = maplibregl.Popup;

        // Use MapTiler winter style for light mode, NextBillion dark style for dark mode
        const getStyleUrl = (dark: boolean) => dark
          ? "/api/map-proxy/maps/dark/style.json"
          : "https://api.maptiler.com/maps/winter-v4/style.json?key=r1TgDWJZq8U2BMrwNqyE";

        // Check localStorage for current theme (avoids flash of wrong theme)
        const savedTheme = localStorage.getItem("theme") || "light";
        const isDark = savedTheme === "dark";

        const map = new maplibregl.Map({
          container: mapContainer.current,
          style: getStyleUrl(isDark),
          zoom: 3.5,
          center: [-98.5795, 39.8283],
          attributionControl: false,
        });
        mapRef.current = { map };

        // Wait for the map style to fully load before signaling ready
        if (map.loaded()) {
          if (!cancelled) setMapReady(true);
        } else {
          map.on("load", () => {
            if (!cancelled) setMapReady(true);
          });
        }

        // Store the getStyleUrl function for use in color scheme listener
        (window as any).__getMapStyleUrl = getStyleUrl;
      } catch (err) {
        console.error("Failed to load maplibre-gl:", err);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.map?.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []); // runs once on mount

  // Render only markers (for zoom updates - doesn't call fitBounds or fetch directions)
  const renderMarkers = useCallback(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance || !mapInstance.map) return;
    const map = mapInstance.map;
    const Marker = (window as any).__Marker;
    const Popup = (window as any).__Popup;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Set of itinerary game positions (rounded) so we can offset ballpark markers that coincide
    const itineraryPosKey = (lat: number, lon: number) =>
      `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
    const itineraryPositions = new Set(
      games
        .filter((g) => g.lat != null && g.lon != null)
        .map((g) => itineraryPosKey(g.lat!, g.lon!))
    );

    // Build set of teams already in the itinerary so we skip their allBallparks markers
    const itineraryTeams = new Set(games.map((g) => g.home_team));

    // Small team logos at all ballparks (all 30 when allBallparks provided)
    if (allBallparks?.length) {
      allBallparks.forEach((t) => {
        // Skip if this team already has an itinerary stop marker
        if (itineraryTeams.has(t.abbr)) return;

        const logoPath = getTeamLogoPath(t.abbr);
        const el = document.createElement("div");
        el.style.cssText =
          "width:28px;height:28px;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;background:#fff;cursor:pointer;";
        if (logoPath) {
          const img = document.createElement("img");
          img.src = logoPath;
          img.alt = t.abbr;
          img.style.cssText = "width:22px;height:22px;object-fit:contain;pointer-events:none;";
          el.appendChild(img);
        } else {
          el.style.background = "#9ca3af";
          el.textContent = t.abbr.slice(0, 1);
          el.style.fontSize = "10px";
          el.style.fontWeight = "700";
          el.style.color = "#fff";
        }
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!BALLPARKS_WITHOUT_3D_MODEL.has(t.abbr)) {
            setSelectedBallpark({ abbr: t.abbr, stadium_name: t.stadium_name || t.abbr });
          }
        });
        const popup = new Popup({ offset: 8, closeButton: false }).setText(
          t.stadium_name || t.abbr
        );
        const marker = new Marker({ element: el })
          .setLngLat({ lng: t.lon, lat: t.lat })
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
      });
    }

    // When no games and no allBallparks: show target parks as gray pins
    if (allTeams && games.length === 0 && !allBallparks?.length) {
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

    // Track occupied positions for start/end offset (game positions + start/end)
    const occupiedForStartEnd = new Set(itineraryPositions);
    let startLng: number | null = null;
    let startLat: number | null = null;
    let endLng: number | null = null;
    let endLat: number | null = null;

    // Start marker (if defined)
    if (startLocation) {
      const startKey = itineraryPosKey(startLocation.lat, startLocation.lon);
      const startCoincides =
        occupiedForStartEnd.has(startKey) ||
        (endLocation && itineraryPosKey(endLocation.lat, endLocation.lon) === startKey);
      startLng = startLocation.lon + (startCoincides ? 0.0075 : 0);
      startLat = startLocation.lat + (startCoincides ? -0.0075 : 0);
      occupiedForStartEnd.add(startKey);
      occupiedForStartEnd.add(itineraryPosKey(startLat, startLng));
      const startEl = document.createElement("div");
      startEl.style.cssText =
        "width:26px;height:26px;border-radius:50%;background:#22c55e;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);";
      startEl.textContent = "S";
      const startPopup = new Popup({ offset: 10, closeButton: false }).setText("Start");
      const startMarker = new Marker({ element: startEl })
        .setLngLat({ lng: startLng, lat: startLat })
        .setPopup(startPopup)
        .addTo(map);
      markersRef.current.push(startMarker);
    }

    // End marker (if defined)
    if (endLocation) {
      const endKey = itineraryPosKey(endLocation.lat, endLocation.lon);
      const endCoincides = occupiedForStartEnd.has(endKey);
      endLng = endLocation.lon + (endCoincides ? -0.0075 : 0);
      endLat = endLocation.lat + (endCoincides ? 0.0075 : 0);
      const endEl = document.createElement("div");
      endEl.style.cssText =
        "width:26px;height:26px;border-radius:50%;background:#ef4444;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);";
      endEl.textContent = "E";
      const endPopup = new Popup({ offset: 10, closeButton: false }).setText("Finish");
      const endMarker = new Marker({ element: endEl })
        .setLngLat({ lng: endLng, lat: endLat })
        .setPopup(endPopup)
        .addTo(map);
      markersRef.current.push(endMarker);
    }

    // Add numbered markers for itinerary games
    const bounds: [number, number, number, number] = [180, 90, -180, -90]; // minLng, minLat, maxLng, maxLat

    games.forEach((g, i) => {
      if (!g.lat || !g.lon) return;
      const el = document.createElement("div");
      const isVisited = visitedParks?.has(g.home_team);
      const borderColor = isVisited ? "#16a34a" : "#2563eb";
      const logoPath = getTeamLogoPath(g.home_team);
      el.style.cssText = `
        width:34px;height:34px;border-radius:50%;
        background:#fff;
        display:flex;align-items:center;justify-content:center;
        border:2.5px solid ${borderColor};box-shadow:0 2px 6px rgba(0,0,0,0.3);
        cursor:pointer;overflow:visible;
      `;
      if (logoPath) {
        const img = document.createElement("img");
        img.src = logoPath;
        img.alt = g.home_team;
        img.style.cssText = "width:24px;height:24px;object-fit:contain;pointer-events:none;";
        el.appendChild(img);
      }
      const badge = document.createElement("div");
      badge.style.cssText = `
        position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;
        border-radius:9px;padding:0 4px;
        background:${borderColor};color:#fff;
        font-size:10px;font-weight:700;line-height:18px;text-align:center;
        border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);
        pointer-events:none;
      `;
      badge.textContent = String(i + 1);
      el.appendChild(badge);

      const awayLogo = getTeamLogoPath(g.away_team);
      const homeLogo = getTeamLogoPath(g.home_team);
      const img = (path: string, abbr: string) =>
        path ? `<img src="${path}" alt="${abbr}" width="20" height="20" style="vertical-align:middle;margin:0 2px;display:inline-block" />` : "";
      const popup = new Popup({ offset: 15, closeButton: false }).setHTML(
        `<div style="font-size:13px;line-height:1.4;width:280px">
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><strong>${awayLogo ? img(awayLogo, g.away_team) : ""} ${g.away_team} @ ${homeLogo ? img(homeLogo, g.home_team) : ""} ${g.home_team}</strong></div>
          <div>${g.stadium_name || ""}, ${g.city || ""}</div>
          <div>${formatLocalDate(g.date_time, g.home_team)} ${formatLocalTime(g.date_time, g.home_team)}</div>
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

    if (startLng != null && startLat != null) {
      bounds[0] = Math.min(bounds[0], startLng);
      bounds[1] = Math.min(bounds[1], startLat);
      bounds[2] = Math.max(bounds[2], startLng);
      bounds[3] = Math.max(bounds[3], startLat);
    }
    if (endLng != null && endLat != null) {
      bounds[0] = Math.min(bounds[0], endLng);
      bounds[1] = Math.min(bounds[1], endLat);
      bounds[2] = Math.max(bounds[2], endLng);
      bounds[3] = Math.max(bounds[3], endLat);
    }

    // Return bounds for use by full render
    return { startLng, startLat, endLng, endLat, bounds };
  }, [games, stopovers, startLocation, endLocation, allTeams, allBallparks, visitedParks]);

  // Full map render: markers + route + fitBounds
  const renderMap = useCallback(async () => {
    const mapInstance = mapRef.current;
    if (!mapInstance || !mapInstance.map) return;
    const map = mapInstance.map;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Marker = (window as any).__Marker;

    // Remove old route layers/sources and airplane markers
    if (map.getLayer("route-line")) map.removeLayer("route-line");
    if (map.getSource("route")) map.removeSource("route");
    if (map.getLayer("flight-line")) map.removeLayer("flight-line");
    if (map.getSource("flights")) map.removeSource("flights");
    airplaneMarkersRef.current.forEach((m) => m.remove());
    airplaneMarkersRef.current = [];

    // Render markers and get bounds
    const result = renderMarkers();
    if (!result) return;
    const { bounds } = result;

    // Fit bounds once
    if (games.length > 0 && games[0]?.lat) {
      map.fitBounds(
        [
          [bounds[0] - 1, bounds[1] - 1],
          [bounds[2] + 1, bounds[3] + 1],
        ],
        { padding: 40, maxZoom: 10, duration: 500 }
      );
    } else if (startLocation || endLocation) {
      map.fitBounds(
        [
          [bounds[0] - 1, bounds[1] - 1],
          [bounds[2] + 1, bounds[3] + 1],
        ],
        { padding: 40, maxZoom: 10, duration: 500 }
      );
    }

    // Fetch directions for route polyline (games + stopovers interleaved by after_index)
    const waypoints: { lat: number; lon: number }[] = [];
    const legStartAtWaypoint: number[] = []; // leg L starts at waypoint index legStartAtWaypoint[L]
    if (startLocation) {
      waypoints.push(startLocation);
      legStartAtWaypoint.push(0);
    }
    games.forEach((g, i) => {
      if (g.lat != null && g.lon != null) {
        waypoints.push({ lat: g.lat, lon: g.lon });
        // Start of a new logical leg when there is a segment leaving this game (next game or end)
        if (i < games.length - 1 || endLocation) legStartAtWaypoint.push(waypoints.length - 1);
      }
      const afterStopovers = stopovers
        .filter((s) => s.after_index === i)
        .sort((a, b) => a.sort_order - b.sort_order);
      afterStopovers.forEach((s) => waypoints.push({ lat: s.lat, lon: s.lon }));
    });
    if (endLocation) waypoints.push(endLocation);

    const numSegments = waypoints.length - 1;
    // Use per-segment modes when length matches; otherwise expand from logical legs
    const segment_modes_expanded: string[] = [];
    if (segmentModes.length === numSegments) {
      for (let w = 0; w < numSegments; w++) {
        segment_modes_expanded.push((segmentModes[w] ?? "car") as string);
      }
    } else {
      for (let w = 0; w < numSegments; w++) {
        let leg = 0;
        while (leg + 1 < legStartAtWaypoint.length && legStartAtWaypoint[leg + 1]! <= w) leg++;
        segment_modes_expanded.push((segmentModes[leg] ?? "car") as string);
      }
    }

    if (waypoints.length >= 2) {
      setLoadingRoute(true);
      try {
        const res = await fetch("/api/directions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            waypoints,
            segment_modes: segment_modes_expanded.slice(0, numSegments),
            itineraryId,
          }),
        });

        if (!res.ok) {
          throw new Error(`Directions API error: ${res.status}`);
        }

        const data = await res.json();

        // Check if map still exists after async fetch (component might have unmounted)
        if (!map || !mapRef.current) {
          return;
        }

        if (data.geometries && data.geometries.length > 0) {
          // Decode and combine all geometry chunks
          const allCoords: [number, number][] = [];
          try {
            for (const geom of data.geometries) {
              if (geom && typeof geom === "string") {
                const decoded = decodePolyline6(geom);
                if (decoded.length > 0) {
                  // Push coordinates one by one to avoid stack overflow with large arrays
                  for (let i = 0; i < decoded.length; i++) {
                    allCoords.push(decoded[i]);
                  }
                }
              }
            }

            if (allCoords.length > 0) {
              // Check map exists again before using it
              if (!map || !mapRef.current) {
                return;
              }
              
              // Remove old route if it exists
              if (map.getLayer("route-line")) map.removeLayer("route-line");
              if (map.getSource("route")) map.removeSource("route");
              
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

              // Airplane icons on flight arcs (with offset when arcs coincide)
              const airSegments: { index: number; coords: [number, number][] }[] = [];
              for (let i = 0; i < (data.geometries?.length ?? 0); i++) {
                if (segment_modes_expanded[i] !== "air") continue;
                const geom = data.geometries[i];
                if (!geom || typeof geom !== "string") continue;
                const coords = decodePolyline6(geom);
                if (coords.length < 2) continue;
                airSegments.push({ index: i, coords });
              }
              // Coincident arcs: same path (A→B) or reverse (B→A). Canonical key from endpoints.
              const keyOf = (c: [number, number][]) => {
                const a = c[0]!;
                const b = c[c.length - 1]!;
                const s = `${a[0].toFixed(4)},${a[1].toFixed(4)}`;
                const t = `${b[0].toFixed(4)},${b[1].toFixed(4)}`;
                return s < t ? `${s}-${t}` : `${t}-${s}`;
              };
              const groups = new Map<string, typeof airSegments>();
              for (const seg of airSegments) {
                const key = keyOf(seg.coords);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(seg);
              }
              // Offset ratio per segment within each group (so icons don't overlap)
              const ratioFor = (group: typeof airSegments, idx: number) => {
                const n = group.length;
                if (n === 1) return 0.5;
                return (idx + 1) / (n + 1);
              };
              for (const [, group] of groups) {
                group.forEach((seg, idxInGroup) => {
                  const t = ratioFor(group, idxInGroup);
                  const coords = seg.coords;
                  const len = coords.length - 1;
                  const segIndex = Math.min(Math.floor(t * len), len - 1);
                  const frac = t * len - segIndex;
                  const p0 = coords[segIndex]!;
                  const p1 = coords[segIndex + 1]!;
                  const lng = p0[0] + frac * (p1[0] - p0[0]);
                  const lat = p0[1] + frac * (p1[1] - p0[1]);
                  const bearing = bearingDeg(p0, p1);
                  const el = createAirplaneElement();
                  const svg = el.querySelector("svg") as SVGElement | null;
                  if (svg) svg.style.transform = `rotate(${bearing}deg)`;
                  const marker = new Marker({ element: el })
                    .setLngLat([lng, lat])
                    .addTo(map);
                  airplaneMarkersRef.current.push(marker);
                });
              }

              setRouteInfo({
                totalDistance: data.totalDistance ?? 0,
                totalDuration: data.totalDuration ?? 0,
                drivingDistance: data.drivingDistance ?? 0,
                drivingDuration: data.drivingDuration ?? 0,
                airDistance: data.airDistance ?? 0,
                airDuration: data.airDuration ?? 0,
              });
            } else {
              console.warn("No coordinates decoded from geometries, falling back to straight lines");
              if (map && mapRef.current) {
                drawStraightLines(map, games);
              }
            }
          } catch (decodeErr) {
            console.error("Failed to decode polyline geometry:", decodeErr);
            if (map && mapRef.current) {
              drawStraightLines(map, games);
            }
          }
        } else {
          console.warn("No geometries in directions response, falling back to straight lines");
          if (map && mapRef.current) {
            drawStraightLines(map, games);
          }
        }
      } catch (err) {
        console.error("Failed to fetch directions:", err);
        // Fallback: draw straight lines between points
        if (map && mapRef.current) {
          drawStraightLines(map, games);
        }
      } finally {
        setLoadingRoute(false);
      }
    }
  }, [games, stopovers, segmentModes, startLocation, endLocation, itineraryId, renderMarkers]);

  // Re-render whenever the map is ready or data changes
  useEffect(() => {
    if (mapReady) {
      renderMap();
    }
  }, [mapReady, games, stopovers, segmentModes, startLocation, endLocation, itineraryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add zoom event listener to update marker positions as user zooms
  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance || !mapInstance.map || !mapReady) return;

    const map = mapInstance.map;
    let zoomTimeout: NodeJS.Timeout;

    const handleZoom = () => {
      clearTimeout(zoomTimeout);
      // Debounce re-render to avoid excessive updates during smooth zooming
      zoomTimeout = setTimeout(() => {
        renderMarkers(); // Only re-render markers on zoom, not full render
      }, 150);
    };

    map.on("zoomend", handleZoom);

    return () => {
      clearTimeout(zoomTimeout);
      map.off("zoomend", handleZoom);
    };
  }, [mapReady, renderMarkers]);

  // Listen for theme changes and update map style
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current.map;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getStyleUrl = (window as any).__getMapStyleUrl;
    if (!getStyleUrl) return;

    // Skip if theme hasn't changed since last application
    if (appliedThemeRef.current === theme) return;
    
    // On first run after map is ready, record the current theme
    if (appliedThemeRef.current === null) {
      appliedThemeRef.current = theme;
      return;
    }

    const isDark = theme === "dark";
    const newStyleUrl = getStyleUrl(isDark);
    
    appliedThemeRef.current = theme;

    // Save current state
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentBearing = map.getBearing();
    const currentPitch = map.getPitch();

    map.setStyle(newStyleUrl);

    // After style loads, restore everything without calling fitBounds
    map.once('styledata', () => {
      if (!mapRef.current) return;

      // Restore viewport
      map.jumpTo({
        center: currentCenter,
        zoom: currentZoom,
        bearing: currentBearing,
        pitch: currentPitch,
      });

      // Re-render markers only (no fitBounds)
      renderMarkers();

      // Re-fetch and render routes (without fitBounds)
      setTimeout(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Marker = (window as any).__Marker;

        // Remove old route layers/sources and airplane markers
        if (map.getLayer("route-line")) map.removeLayer("route-line");
        if (map.getSource("route")) map.removeSource("route");
        if (map.getLayer("flight-line")) map.removeLayer("flight-line");
        if (map.getSource("flights")) map.removeSource("flights");
        airplaneMarkersRef.current.forEach((m) => m.remove());
        airplaneMarkersRef.current = [];

        // Fetch and render directions
        const waypoints: { lat: number; lon: number }[] = [];
        const legStartAtWaypoint: number[] = [];
        if (startLocation) {
          waypoints.push(startLocation);
          legStartAtWaypoint.push(0);
        }
        games.forEach((g, i) => {
          if (g.lat != null && g.lon != null) {
            waypoints.push({ lat: g.lat, lon: g.lon });
            if (i < games.length - 1 || endLocation) legStartAtWaypoint.push(waypoints.length - 1);
          }
          const afterStopovers = stopovers
            .filter((s) => s.after_index === i)
            .sort((a, b) => a.sort_order - b.sort_order);
          afterStopovers.forEach((s) => waypoints.push({ lat: s.lat, lon: s.lon }));
        });
        if (endLocation) waypoints.push(endLocation);

        const numSegments = waypoints.length - 1;
        const segment_modes_expanded: string[] = [];
        if (segmentModes.length === numSegments) {
          for (let w = 0; w < numSegments; w++) {
            segment_modes_expanded.push((segmentModes[w] ?? "car") as string);
          }
        } else {
          for (let w = 0; w < numSegments; w++) {
            let leg = 0;
            while (leg + 1 < legStartAtWaypoint.length && legStartAtWaypoint[leg + 1]! <= w) leg++;
            segment_modes_expanded.push((segmentModes[leg] ?? "car") as string);
          }
        }

        if (waypoints.length >= 2) {
          try {
            const res = await fetch("/api/directions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                waypoints,
                segment_modes: segment_modes_expanded.slice(0, numSegments),
                itineraryId,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              if (data.geometries && data.geometries.length > 0 && mapRef.current) {
                const allCoords: [number, number][] = [];
                for (const geom of data.geometries) {
                  if (geom && typeof geom === "string") {
                    const decoded = decodePolyline6(geom);
                    for (let i = 0; i < decoded.length; i++) {
                      allCoords.push(decoded[i]);
                    }
                  }
                }

                if (allCoords.length > 0 && mapRef.current) {
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

                  // Add airplane markers
                  const airSegments: { index: number; coords: [number, number][] }[] = [];
                  for (let i = 0; i < (data.geometries?.length ?? 0); i++) {
                    if (segment_modes_expanded[i] !== "air") continue;
                    const geom = data.geometries[i];
                    if (!geom || typeof geom !== "string") continue;
                    const coords = decodePolyline6(geom);
                    if (coords.length < 2) continue;
                    airSegments.push({ index: i, coords });
                  }

                  const keyOf = (c: [number, number][]) => {
                    const a = c[0]!;
                    const b = c[c.length - 1]!;
                    const s = `${a[0].toFixed(4)},${a[1].toFixed(4)}`;
                    const t = `${b[0].toFixed(4)},${b[1].toFixed(4)}`;
                    return s < t ? `${s}-${t}` : `${t}-${s}`;
                  };
                  const groups = new Map<string, typeof airSegments>();
                  for (const seg of airSegments) {
                    const key = keyOf(seg.coords);
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(seg);
                  }

                  const ratioFor = (group: typeof airSegments, idx: number) => {
                    const n = group.length;
                    if (n === 1) return 0.5;
                    return (idx + 1) / (n + 1);
                  };

                  for (const [, group] of groups) {
                    group.forEach((seg, idxInGroup) => {
                      const t = ratioFor(group, idxInGroup);
                      const coords = seg.coords;
                      const len = coords.length - 1;
                      const segIndex = Math.min(Math.floor(t * len), len - 1);
                      const frac = t * len - segIndex;
                      const p0 = coords[segIndex]!;
                      const p1 = coords[segIndex + 1]!;
                      const lng = p0[0] + frac * (p1[0] - p0[0]);
                      const lat = p0[1] + frac * (p1[1] - p0[1]);
                      const bearing = bearingDeg(p0, p1);
                      const el = createAirplaneElement();
                      const svg = el.querySelector("svg") as SVGElement | null;
                      if (svg) svg.style.transform = `rotate(${bearing}deg)`;
                      const marker = new Marker({ element: el })
                        .setLngLat([lng, lat])
                        .addTo(map);
                      airplaneMarkersRef.current.push(marker);
                    });
                  }

                  setRouteInfo({
                    totalDistance: data.totalDistance ?? 0,
                    totalDuration: data.totalDuration ?? 0,
                    drivingDistance: data.drivingDistance ?? 0,
                    drivingDuration: data.drivingDuration ?? 0,
                    airDistance: data.airDistance ?? 0,
                    airDuration: data.airDuration ?? 0,
                  });
                }
              }
            }
          } catch (err) {
            console.error("Failed to re-fetch directions after style change:", err);
          }
        }
      }, 100);
    });
  }, [theme, mapReady, renderMarkers, games, stopovers, segmentModes, startLocation, endLocation, itineraryId]);

  return (
    <div className="relative">
      <div ref={mapContainer} className="w-full rounded-lg border h-[calc(100vh-260px)] min-h-[400px]" />

      {/* Route loading spinner */}
      {loadingRoute && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-card/90 backdrop-blur rounded-full p-3 shadow-lg">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </div>
      )}

      {/* Itinerary side panel */}
      <div
        className={`absolute top-0 right-0 h-full w-80 transition-transform duration-300 ease-in-out ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          className="absolute -left-8 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-l-md bg-card/95 shadow-md border border-r-0 border-border hover:bg-muted"
          title={panelOpen ? "Hide itinerary" : "Show itinerary"}
        >
          {panelOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <div className="h-full rounded-r-lg border-l bg-card/95 backdrop-blur shadow-lg flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b font-semibold text-sm shrink-0">Travel Itinerary</div>
          <ScrollArea className="flex-1 min-h-0 px-3 py-2">
            <div className="space-y-1">
              {(() => {
                let segIdx = 0;
                const fmtDate = (dt: string, homeTeam: string) => formatLocalDate(dt, homeTeam);
                const fmtTime = (dt: string, homeTeam: string) => formatLocalTime(dt, homeTeam);
                const modeIcon = (idx: number) => {
                  const mode = segmentModes?.[idx] ?? "car";
                  return (
                    <div className="flex items-center justify-center gap-1 py-1 text-muted-foreground">
                      <div className="h-px w-6 bg-border" />
                      {mode === "air" ? <Plane className="h-3.5 w-3.5" /> : <Car className="h-3.5 w-3.5" />}
                      <div className="h-px w-6 bg-border" />
                    </div>
                  );
                };

                const sortedStopovers = (stopovers ?? []).slice().sort((a, b) => a.after_index - b.after_index || a.sort_order - b.sort_order);
                const stopoversAfter = (idx: number) => sortedStopovers.filter((s) => s.after_index === idx);

                return (
                  <>
                    {startLocation && (
                      <>
                        <div className="flex items-center gap-2 rounded bg-green-500/20 border border-green-500/30 px-2 py-1.5 text-xs">
                          <span className="font-semibold text-green-400">Start</span>
                        </div>
                        {(games.length > 0 || endLocation) && modeIcon(segIdx++)}
                      </>
                    )}
                    {games.map((g, i) => {
                      const sAfter = stopoversAfter(i);
                      return (
                        <div key={g.game_id}>
                          <div className="flex items-start gap-2 rounded border px-2 py-1.5 text-xs bg-card hover:bg-muted/50">
                            <span className="mt-0.5 font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 font-medium">
                                {g.home_team && (
                                  <img src={getTeamLogoPath(g.away_team)} alt={g.away_team} className="h-4 w-4" />
                                )}
                                <span>@</span>
                                {g.home_team && (
                                  <img src={getTeamLogoPath(g.home_team)} alt={g.home_team} className="h-4 w-4" />
                                )}
                                <span className="ml-0.5 truncate">{g.away_team} @ {g.home_team}</span>
                              </div>
                              {g.stadium_name && (
                                <div className="text-muted-foreground truncate">{g.stadium_name}</div>
                              )}
                              <div className="text-muted-foreground">{fmtDate(g.date_time, g.home_team)} {fmtTime(g.date_time, g.home_team)}</div>
                            </div>
                          </div>
                          {sAfter.map((s) => (
                            <div key={`stop-${s.after_index}-${s.sort_order}`}>
                              {modeIcon(segIdx++)}
                              <div className="flex items-center gap-2 rounded border border-dashed border-muted px-2 py-1.5 text-xs bg-muted/20">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-muted-foreground">Stopover</span>
                              </div>
                            </div>
                          ))}
                          {(i < games.length - 1 || endLocation) && modeIcon(segIdx++)}
                        </div>
                      );
                    })}
                    {endLocation && (
                      <div className="flex items-center gap-2 rounded bg-destructive/20 border border-destructive/30 px-2 py-1.5 text-xs">
                        <span className="font-semibold text-destructive">End</span>
                      </div>
                    )}
                    {games.length === 0 && !startLocation && !endLocation && (
                      <p className="text-xs text-muted-foreground text-center py-4">No games in itinerary yet</p>
                    )}
                  </>
                );
              })()}
            </div>
          </ScrollArea>
        </div>
      </div>

      {routeInfo && (
        <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur rounded-md px-3 py-2 text-xs shadow space-y-1">
          {routeInfo.drivingDistance > 0 && (
            <div>
              <span className="text-muted-foreground">Driving: </span>
              <span className="font-medium">
                {Math.round(routeInfo.drivingDistance / 1609.34).toLocaleString()} mi
              </span>
              <span className="text-muted-foreground ml-1">
                (~{Math.round(routeInfo.drivingDuration / 3600)} hrs)
              </span>
            </div>
          )}
          {routeInfo.airDistance > 0 && (
            <div>
              <span className="text-muted-foreground">Air: </span>
              <span className="font-medium">
                {Math.round(routeInfo.airDistance / 1609.34).toLocaleString()} mi
              </span>
              <span className="text-muted-foreground ml-1">
                (~{Math.round(routeInfo.airDuration / 3600)} hrs)
              </span>
            </div>
          )}
          {routeInfo.drivingDistance === 0 && routeInfo.airDistance === 0 && routeInfo.totalDistance > 0 && (
            <div>
              <span className="font-medium">
                {Math.round(routeInfo.totalDistance / 1609.34).toLocaleString()} mi
              </span>
              <span className="mx-2 text-muted-foreground">&middot;</span>
              <span className="text-muted-foreground">
                ~{Math.round(routeInfo.totalDuration / 3600)} hrs
              </span>
            </div>
          )}
        </div>
      )}

      {/* NextBillion.ai attribution */}
      <a
        href="https://nextbillion.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 left-3 bg-card/90 backdrop-blur rounded-md px-2 py-1.5 shadow hover:bg-card transition-colors"
        title="Powered by NextBillion.ai"
      >
        <img
          src="/logo.png"
          alt="NextBillion.ai"
          className="h-6 w-auto rounded opacity-80 hover:opacity-100 transition-opacity"
        />
      </a>
      <Dialog open={!!selectedBallpark} onOpenChange={(open) => !open && setSelectedBallpark(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden" showCloseButton>
          {selectedBallpark && (
            <>
              <DialogHeader className="px-6 pt-6 pb-2">
                <DialogTitle>{selectedBallpark.stadium_name}</DialogTitle>
              </DialogHeader>
              <StadiumViewer
                abbr={selectedBallpark.abbr}
                stadiumName={selectedBallpark.stadium_name}
                className="px-6 pb-6"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
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
