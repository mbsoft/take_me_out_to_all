"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Trash2, Map, List, Check, MapPin, Car, Plane, Sparkles, Loader2, Pencil, Lock, Unlock, Share2, Link2, Link2Off, BookmarkPlus } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeamLogo, GameMatchup } from "@/components/team-logo";
import { PlaceAutocomplete, type PlaceResult } from "@/components/place-autocomplete";
import { GameDetailPanel } from "@/components/game-detail-panel";
import { goalLabel, filterTeamsByGoal } from "@/lib/goal-utils";

import { track } from "@/lib/analytics";
const ItineraryMap = dynamic(() => import("@/components/itinerary-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[550px] rounded-lg border flex items-center justify-center bg-muted/50">
      <p className="text-sm text-muted-foreground">Loading map...</p>
    </div>
  ),
});

interface Game {
  game_id: number;
  day: string;
  date_time: string;
  away_team: string;
  home_team: string;
  stadium_name?: string;
  city?: string;
  state?: string;
  home_team_name?: string;
  away_team_name?: string;
  lat?: number;
  lon?: number;
  sort_order?: number;
  id?: string; // itinerary_game id
  notes?: string;
  locked?: boolean;
}

interface Stopover {
  id: string;
  itinerary_id: string;
  after_index: number;
  label: string;
  lat: number;
  lon: number;
  sort_order: number;
}

interface Itinerary {
  id: string;
  name: string;
  goal: string;
  travel_mode: string;
  start_date?: string;
  start_location: string;
  start_lat?: number;
  start_lon?: number;
  end_location: string;
  end_lat?: number;
  end_lon?: number;
  games: Game[];
  stopovers?: Stopover[];
  segment_modes?: string[];
  custom_teams?: string[] | null;
  share_token?: string | null;
}

interface Suggestion {
  game_id: number;
  home_team: string;
  away_team: string;
  date_time: string;
  stadium_name: string;
  city: string;
  distance: number;
}

/** MLB team timezone mapping */
const TEAM_TIMEZONES: Record<string, string> = {
  ARI: "America/Phoenix", ATH: "America/Los_Angeles", ATL: "America/New_York",
  BAL: "America/New_York", BOS: "America/New_York", CHC: "America/Chicago",
  CHW: "America/Chicago", CIN: "America/New_York", CLE: "America/New_York",
  COL: "America/Denver", DET: "America/New_York", HOU: "America/Chicago",
  KC: "America/Chicago", LAA: "America/Los_Angeles", LAD: "America/Los_Angeles",
  MIA: "America/New_York", MIL: "America/Chicago", MIN: "America/Chicago",
  NYM: "America/New_York", NYY: "America/New_York", PHI: "America/New_York",
  PIT: "America/New_York", SD: "America/Los_Angeles", SEA: "America/Los_Angeles",
  SF: "America/Los_Angeles", STL: "America/Chicago", TB: "America/New_York",
  TEX: "America/Chicago", TOR: "America/New_York", WSH: "America/New_York",
};

function formatDate(dt: string, homeTeam: string) {
  try {
    const date = new Date(dt);
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

function formatTime(dt: string, homeTeam: string) {
  try {
    const date = new Date(dt);
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

function isDayGame(dt: string) {
  const hour = parseInt(dt.slice(11, 13));
  return hour < 17;
}

export default function ItineraryBuilderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [teamFilter, setTeamFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dayOnly, setDayOnly] = useState(false);
  const [teams, setTeams] = useState<Array<{ abbr: string; name: string; league: string; lat?: number; lon?: number; stadium_name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stopoverAddingAfterIndex, setStopoverAddingAfterIndex] = useState<number | null>(null);
  const [stopoverSearchValue, setStopoverSearchValue] = useState("");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [addingGameId, setAddingGameId] = useState<number | null>(null);
  const [removingGameId, setRemovingGameId] = useState<number | null>(null);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoGenerateResult, setAutoGenerateResult] = useState<{
    games_added: number;
    total_parks: number;
    parks_covered: number;
    infeasible_parks: string[];
    total_distance_miles: number;
    estimated_days: number;
  } | null>(null);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [editingStartLocation, setEditingStartLocation] = useState(false);
  const [startLocationSearch, setStartLocationSearch] = useState("");
  const [editingEndLocation, setEditingEndLocation] = useState(false);
  const [endLocationSearch, setEndLocationSearch] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameEditValue, setNameEditValue] = useState("");
  const [directionsLegs, setDirectionsLegs] = useState<Array<{ distance: number; duration: number; mode: string }>>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadItinerary = useCallback(async (): Promise<Itinerary | undefined> => {
    const res = await fetch(`/api/itineraries/${id}`);
    if (!res.ok) return undefined;
    const data = await res.json();
    setItinerary(data);
    setShareToken(data.share_token ?? null);

    // Load cached legs from route_geometry for cost calculation
    if (data.route_geometry) {
      try {
        const cached = typeof data.route_geometry === "string"
          ? JSON.parse(data.route_geometry)
          : data.route_geometry;
        if (cached.legs && Array.isArray(cached.legs)) {
          setDirectionsLegs(cached.legs);
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Set start date filter: use last game's date if games exist, otherwise itinerary's start_date
    if (data.games?.length > 0) {
      const lastGame = data.games[data.games.length - 1];
      if (lastGame.date_time) {
        setStartDate(lastGame.date_time.split("T")[0]);
      }
    } else if (data.start_date) {
      setStartDate(data.start_date.split("T")[0]);
    }
    return data;
  }, [id]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadItinerary().then(() => setLoading(false));
    fetch("/api/teams").then((r) => r.json()).then(setTeams);
  }, [status, loadItinerary]);

  // Load available games when filters change
  useEffect(() => {
    const p = new URLSearchParams();
    if (teamFilter) p.set("team", teamFilter);
    if (startDate) p.set("startDate", startDate);
    if (endDate) p.set("endDate", endDate);
    if (dayOnly) p.set("dayOnly", "true");
    fetch(`/api/games?${p}`).then((r) => r.json()).then(setAvailableGames);
  }, [teamFilter, startDate, endDate, dayOnly]);

  // Load suggestions
  const loadSuggestions = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/suggest?itineraryId=${id}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error("Failed to load suggestions:", error);
      setSuggestions([]);
    }
  }, [id]);

  useEffect(() => {
    if (!itinerary) return;
    loadSuggestions();
  }, [itinerary, loadSuggestions]);

  const handleDirectionsLoaded = useCallback((data: {
    legs: Array<{ distance: number; duration: number; mode: string }>;
    drivingDistance: number;
    airDistance: number;
  }) => {
    setDirectionsLegs(data.legs);
  }, []);

  async function addGame(gameId: number) {
    setAddingGameId(gameId);
    try {
      await fetch(`/api/itineraries/${id}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId }),
      });
      await loadItinerary();
      // Reload suggestions after adding a game
      await loadSuggestions();
    } finally {
      setAddingGameId(null);
    }
  }

  async function removeGame(gameId: number) {
    setRemovingGameId(gameId);
    try {
      await fetch(`/api/itineraries/${id}/games/${gameId}`, { method: "DELETE" });
      await loadItinerary();
      // Reload suggestions after removing a game
      await loadSuggestions();
    } finally {
      setRemovingGameId(null);
    }
  }

  async function toggleLock(gameId: number, locked: boolean) {
    // Optimistic update
    setItinerary((prev) =>
      prev
        ? { ...prev, games: prev.games.map((g) => (g.game_id === gameId ? { ...g, locked } : g)) }
        : prev
    );
    await fetch(`/api/itineraries/${id}/games/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked }),
    });
  }

  const [clearing, setClearing] = useState(false);

  async function clearAllGames() {
    if (!itinerary || itinerary.games.length === 0) return;
    const unlocked = itinerary.games.filter((g) => !g.locked);
    if (unlocked.length === 0) return;
    setClearing(true);
    try {
      for (const g of unlocked) {
        await fetch(`/api/itineraries/${id}/games/${g.game_id}`, { method: "DELETE" });
      }
      // Clear stopovers too
      for (const s of itinerary.stopovers ?? []) {
        await fetch(`/api/itineraries/${id}/stopovers/${s.id}`, { method: "DELETE" });
      }
      await loadItinerary();
      await loadSuggestions();
    } finally {
      setClearing(false);
    }
  }

  async function addStopover(afterIndex: number, place: PlaceResult) {
    const res = await fetch(`/api/itineraries/${id}/stopovers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        after_index: afterIndex,
        label: place.label,
        lat: place.lat,
        lon: place.lng,
      }),
    });
    if (res.ok) {
      setStopoverAddingAfterIndex(null);
      setStopoverSearchValue("");
      const loaded = await loadItinerary();
      if (!loaded) return;
      const base = loaded.segment_modes ?? [];
      const insertIdx = (loaded.start_location ? 1 : 0) + afterIndex + 1;
      const expanded = [...base.slice(0, insertIdx), "car", ...base.slice(insertIdx)];
      await fetch(`/api/itineraries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: loaded.name,
          goal: loaded.goal,
          custom_teams: loaded.custom_teams ?? null,
          travel_mode: loaded.travel_mode,
          start_date: loaded.start_date ?? null,
          start_location: loaded.start_location ?? null,
          start_lat: loaded.start_lat ?? null,
          start_lon: loaded.start_lon ?? null,
          end_location: loaded.end_location ?? null,
          end_lat: loaded.end_lat ?? null,
          end_lon: loaded.end_lon ?? null,
          segment_modes: expanded,
        }),
      });
      await loadItinerary();
    }
  }

  async function removeStopover(stopoverId: string) {
    const stopover = (itinerary?.stopovers ?? []).find((s) => s.id === stopoverId);
    if (!itinerary || !stopover) {
      await fetch(`/api/itineraries/${id}/stopovers/${stopoverId}`, { method: "DELETE" });
      await loadItinerary();
      return;
    }
    const nodeIdx =
      (itinerary.start_location ? 1 : 0) +
      stopover.after_index +
      (itinerary.stopovers ?? []).filter(
        (s) => s.after_index === stopover.after_index && s.sort_order < stopover.sort_order
      ).length;
    await fetch(`/api/itineraries/${id}/stopovers/${stopoverId}`, { method: "DELETE" });
    const data = await loadItinerary();
    if (data) {
      const base = data.segment_modes ?? [];
      const removed = [...base.slice(0, nodeIdx), ...base.slice(nodeIdx + 1)];
      await fetch(`/api/itineraries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          goal: data.goal,
          custom_teams: data.custom_teams ?? null,
          travel_mode: data.travel_mode,
          start_date: data.start_date ?? null,
          start_location: data.start_location ?? null,
          start_lat: data.start_lat ?? null,
          start_lon: data.start_lon ?? null,
          end_location: data.end_location ?? null,
          end_lat: data.end_lat ?? null,
          end_lon: data.end_lon ?? null,
          segment_modes: removed,
        }),
      });
      await loadItinerary();
    }
  }

  function getNumSegments(it: Itinerary): number {
    let n = (it.start_location ? 1 : 0) + it.games.length + (it.end_location ? 1 : 0);
    (it.stopovers ?? []).forEach(() => n++);
    return Math.max(0, n - 1);
  }

  async function updateSegmentMode(segmentIndex: number, mode: "car" | "air") {
    if (!itinerary) return;
    const numSegments = getNumSegments(itinerary);
    const base = itinerary.segment_modes ?? [];
    const next = base.length >= numSegments ? [...base.slice(0, numSegments)] : [...base];
    while (next.length < numSegments) next.push("car");
    next[segmentIndex] = mode;
    setItinerary((prev) => (prev ? { ...prev, segment_modes: next } : null));
    const res = await fetch(`/api/itineraries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: itinerary.name,
        goal: itinerary.goal,
        custom_teams: itinerary.custom_teams ?? null,
        travel_mode: itinerary.travel_mode,
        start_date: itinerary.start_date ?? null,
        start_location: itinerary.start_location ?? null,
        start_lat: itinerary.start_lat ?? null,
        start_lon: itinerary.start_lon ?? null,
        end_location: itinerary.end_location ?? null,
        end_lat: itinerary.end_lat ?? null,
        end_lon: itinerary.end_lon ?? null,
        segment_modes: next,
      }),
    });
    if (!res.ok) {
      loadItinerary();
    }
  }

  async function updateLocation(which: "start" | "end", place: PlaceResult) {
    if (!itinerary) return;
    const updates = which === "start"
      ? { start_location: place.label, start_lat: place.lat, start_lon: place.lng }
      : { end_location: place.label, end_lat: place.lat, end_lon: place.lng };
    setItinerary((prev) => prev ? { ...prev, ...updates } : null);
    if (which === "start") {
      setEditingStartLocation(false);
      setStartLocationSearch("");
    } else {
      setEditingEndLocation(false);
      setEndLocationSearch("");
    }
    const res = await fetch(`/api/itineraries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: itinerary.name,
        goal: itinerary.goal,
        custom_teams: itinerary.custom_teams ?? null,
        travel_mode: itinerary.travel_mode,
        start_date: itinerary.start_date ?? null,
        start_location: which === "start" ? place.label : itinerary.start_location ?? null,
        start_lat: which === "start" ? place.lat : itinerary.start_lat ?? null,
        start_lon: which === "start" ? place.lng : itinerary.start_lon ?? null,
        end_location: which === "end" ? place.label : itinerary.end_location ?? null,
        end_lat: which === "end" ? place.lat : itinerary.end_lat ?? null,
        end_lon: which === "end" ? place.lng : itinerary.end_lon ?? null,
        segment_modes: itinerary.segment_modes ?? [],
      }),
    });
    if (!res.ok) {
      loadItinerary();
    }
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination || !itinerary) return;
    const games = [...itinerary.games];
    const [moved] = games.splice(result.source.index, 1);
    games.splice(result.destination.index, 0, moved);

    setItinerary({ ...itinerary, games });

    await fetch(`/api/itineraries/${id}/games/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_ids: games.map((g) => g.game_id) }),
    });

    // Reload suggestions after reordering (last game position may have changed)
    await loadSuggestions();
  }

  async function handleAutoGenerate() {
    setAutoGenerating(true);
    setAutoGenerateResult(null);
    try {
      const now = new Date();
      const localDate = now.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
      const localTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      const description = `${itinerary?.name ?? ""}-${localDate} ${localTime}`;
      const res = await fetch(`/api/itineraries/${id}/auto-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: startDate || undefined, end_date: endDate || undefined, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to auto-generate itinerary");
        return;
      }
      setAutoGenerateResult(data);
      track("itinerary_generated", { goal: itinerary?.goal ?? null, travel_mode: itinerary?.travel_mode ?? null, regenerate: (itinerary?.games.length ?? 0) > 0 });
      await loadItinerary();
      await loadSuggestions();
    } catch (err) {
      console.error("Auto-generate failed:", err);
      alert("Auto-generate failed. Please try again.");
    } finally {
      setAutoGenerating(false);
      setRegenerateDialogOpen(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/itineraries/${id}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to delete itinerary:", error);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  async function saveName(newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || !itinerary || trimmed === itinerary.name) {
      setEditingName(false);
      return;
    }
    setItinerary((prev) => prev ? { ...prev, name: trimmed } : prev);
    setEditingName(false);
    const res = await fetch(`/api/itineraries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmed,
        goal: itinerary.goal,
        custom_teams: itinerary.custom_teams ?? null,
        travel_mode: itinerary.travel_mode,
        start_date: itinerary.start_date ?? null,
        start_location: itinerary.start_location ?? null,
        start_lat: itinerary.start_lat ?? null,
        start_lon: itinerary.start_lon ?? null,
        end_location: itinerary.end_location ?? null,
        end_lat: itinerary.end_lat ?? null,
        end_lon: itinerary.end_lon ?? null,
        segment_modes: itinerary.segment_modes ?? [],
      }),
    });
    if (!res.ok) {
      loadItinerary();
    }
  }

  if (loading || !itinerary) {
    return <p className="text-center py-12 text-muted-foreground">Loading...</p>;
  }

  const addedGameIds = new Set(itinerary.games.map((g) => g.game_id));
  const visitedParks = new Set(itinerary.games.map((g) => g.home_team));

  // Build flat list of nodes: start?, game0, stopovers after 0, game1, stopovers after 1, ..., end?
  type Node =
    | { type: "start" }
    | { type: "game"; game: Game; gameIndex: number }
    | { type: "stopover"; stopover: Stopover; gameIndex: number }
    | { type: "end" };
  const nodes: Node[] = [];
  if (itinerary.start_location) nodes.push({ type: "start" });
  itinerary.games.forEach((g, gameIndex) => {
    nodes.push({ type: "game", game: g, gameIndex });
    (itinerary.stopovers ?? [])
      .filter((s) => s.after_index === gameIndex)
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((s) => nodes.push({ type: "stopover", stopover: s, gameIndex }));
  });
  if (itinerary.end_location) nodes.push({ type: "end" });

  const numSegments = Math.max(0, nodes.length - 1);
  const segmentModes = (() => {
    const base = itinerary.segment_modes ?? [];
    if (base.length >= numSegments) return base.slice(0, numSegments);
    const next = [...base];
    while (next.length < numSegments) next.push("car");
    return next;
  })();

  const targetTeams = filterTeamsByGoal(teams, itinerary.goal, itinerary.custom_teams ?? undefined);
  const totalParks = targetTeams.length;
  const progressPct = totalParks > 0 ? (visitedParks.size / totalParks) * 100 : 0;

  const filteredAvailable = availableGames.filter((g) => !addedGameIds.has(g.game_id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {editingName ? (
            <input
              autoFocus
              className="text-2xl font-bold bg-transparent border-b-2 border-primary outline-none w-full max-w-md"
              value={nameEditValue}
              onChange={(e) => setNameEditValue(e.target.value)}
              onBlur={() => saveName(nameEditValue)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName(nameEditValue);
                if (e.key === "Escape") setEditingName(false);
              }}
            />
          ) : (
            <h1
              className="text-2xl font-bold cursor-pointer hover:text-primary/80 transition-colors"
              onClick={() => { setNameEditValue(itinerary.name); setEditingName(true); }}
              title="Click to rename"
            >
              {itinerary.name}
            </h1>
          )}
          <p className="text-sm text-muted-foreground">
            {goalLabel(itinerary.goal, itinerary.custom_teams)}
            {" "}&middot; {itinerary.travel_mode}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
          {itinerary.games.length > 0 && (
            shareToken ? (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  onClick={async () => {
                    const url = `${window.location.origin}/share/${shareToken}`;
                    await navigator.clipboard.writeText(url);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {shareCopied ? "Copied!" : "Copy Link"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Revoke share link"
                  onClick={async () => {
                    await fetch(`/api/itineraries/${id}/share`, { method: "DELETE" });
                    track("share_link_revoked");
                    setShareToken(null);
                  }}
                >
                  <Link2Off className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                disabled={shareLoading}
                onClick={async () => {
                  setShareLoading(true);
                  try {
                    const res = await fetch(`/api/itineraries/${id}/share`, { method: "POST" });
                    if (res.ok) {
                      const data = await res.json();
                      setShareToken(data.share_token);
                      track("share_link_created");
                      const url = `${window.location.origin}/share/${data.share_token}`;
                      await navigator.clipboard.writeText(url);
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2000);
                    }
                  } finally {
                    setShareLoading(false);
                  }
                }}
              >
                <Share2 className="h-4 w-4 mr-2" />
                {shareLoading ? "Sharing..." : shareCopied ? "Copied!" : "Share"}
              </Button>
            )
          )}
          {session?.user?.role === "admin" && itinerary.games.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setTemplateName(itinerary.name);
                setTemplateDescription("");
                setTemplateSaved(false);
                setTemplateDialogOpen(true);
              }}
            >
              <BookmarkPlus className="h-4 w-4 mr-2" />
              Save as Template
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">
              {visitedParks.size} / {totalParks} ballparks
            </span>
            <span className="text-sm text-muted-foreground">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-2.5" />
          <div className="flex flex-wrap gap-1 mt-2">
            {targetTeams.map((t) => (
              <Badge
                key={t.abbr}
                variant="outline"
                className={`text-xs flex items-center gap-1 ${
                  visitedParks.has(t.abbr)
                    ? "bg-muted/60 border-muted-foreground/20"
                    : addedGameIds.size > 0
                    ? "opacity-50"
                    : ""
                }`}
              >
                <TeamLogo abbr={t.abbr} size={16} />
                {visitedParks.has(t.abbr) && <Check className="h-3.5 w-3.5 text-green-600" />}
                {t.abbr}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* View toggle: List vs Map */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "map")}>
        <TabsList>
          <TabsTrigger value="list" className="gap-1">
            <List className="h-4 w-4" /> Itinerary Builder
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-1">
            <Map className="h-4 w-4" /> Map View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="mt-4">
          <ItineraryMap
            games={itinerary.games}
            stopovers={itinerary.stopovers ?? []}
            segmentModes={segmentModes}
            startLocation={
              itinerary.start_lat && itinerary.start_lon
                ? { lat: itinerary.start_lat as unknown as number, lon: itinerary.start_lon as unknown as number, label: itinerary.start_location || undefined }
                : null
            }
            endLocation={
              itinerary.end_lat && itinerary.end_lon
                ? { lat: itinerary.end_lat as unknown as number, lon: itinerary.end_lon as unknown as number, label: itinerary.end_location || undefined }
                : null
            }
            travelMode={itinerary.travel_mode}
            allTeams={targetTeams
              .filter((t) => t.lat && t.lon)
              .map((t) => ({
                abbr: t.abbr,
                lat: t.lat!,
                lon: t.lon!,
                stadium_name: t.stadium_name || t.abbr,
              }))}
            allBallparks={teams
              .filter((t) => t.lat && t.lon)
              .map((t) => ({
                abbr: t.abbr,
                lat: t.lat!,
                lon: t.lon!,
                stadium_name: t.stadium_name || t.abbr,
              }))}
            visitedParks={visitedParks}
            itineraryId={id}
            onGameClick={(gameId) => {
              const game = itinerary.games.find((g) => g.game_id === gameId);
              if (game) setSelectedGame(game);
            }}
            onSegmentModeToggle={(segIdx, newMode) => updateSegmentMode(segIdx, newMode)}
            onDirectionsLoaded={handleDirectionsLoaded}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Suggested Next Games</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {suggestions.map((s) => {
                const isAdding = addingGameId === s.game_id;
                return (
                  <Card
                    key={s.game_id}
                    className={`min-w-[200px] flex-shrink-0 transition-opacity ${isAdding ? 'opacity-50' : ''}`}
                  >
                    <CardContent className="p-3 space-y-1">
                      <div className="font-medium text-sm">
                        <GameMatchup awayTeam={s.away_team} homeTeam={s.home_team} size={18} />
                      </div>
                      <div className="text-xs text-muted-foreground">{s.stadium_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(s.date_time, s.home_team)} &middot; {s.distance} mi
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-1"
                        onClick={() => addGame(s.game_id)}
                        disabled={isAdding}
                      >
                        {isAdding ? "Adding..." : "Add"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid md:grid-cols-[2fr_3fr] gap-6">
        {/* Left: Available games */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Available Games</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Team</Label>
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                >
                  <option value="">All Teams</option>
                  {teams.map((t) => (
                    <option key={t.abbr} value={t.abbr}>{t.abbr} - {t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={dayOnly}
                    onChange={(e) => setDayOnly(e.target.checked)}
                  />
                  Day games only
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <Separator />
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {filteredAvailable.slice(0, 100).map((g) => {
                  const isAdding = addingGameId === g.game_id;
                  return (
                    <div
                      key={g.game_id}
                      className={`flex items-center justify-between p-2 rounded hover:bg-muted text-sm transition-opacity ${isAdding ? 'opacity-50' : ''}`}
                    >
                      <div>
                        <span className="font-medium inline-flex items-center gap-1.5">
                          <GameMatchup awayTeam={g.away_team} homeTeam={g.home_team} size={18} />
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatDate(g.date_time, g.home_team)} {formatTime(g.date_time, g.home_team)}
                          {isDayGame(g.date_time) && (
                            <Badge variant="outline" className="ml-1 text-[10px] py-0">DAY</Badge>
                          )}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => addGame(g.game_id)}
                        disabled={isAdding}
                      >
                        {isAdding ? "Adding..." : "+ Add"}
                      </Button>
                    </div>
                  );
                })}
                {filteredAvailable.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No matching games
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Itinerary */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Your Itinerary ({itinerary.games.length} games)
              </CardTitle>
              {itinerary.games.length > 0 && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1"
                    onClick={() => setRegenerateDialogOpen(true)}
                    disabled={autoGenerating}
                  >
                    {autoGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Regenerate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={clearAllGames}
                    disabled={clearing}
                  >
                    {clearing ? "Clearing..." : "Clear All"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="itinerary">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}>
                    <ScrollArea className="h-[500px]">
                        <div className="space-y-1">
                          {(() => {
                            let segIdx = 0;
                            const renderSegmentSelector = (segmentIndex: number) => {
                              const mode = segmentModes[segmentIndex] ?? "car";
                              const leg = directionsLegs[segmentIndex];
                              const distanceMiles = leg ? Math.round(leg.distance / 1609.34) : 0;
                              return (
                                <div key={`seg-${segmentIndex}`} className="flex flex-col items-center py-1">
                                  <div className="flex w-full items-center gap-2">
                                    <div className="h-px flex-1 bg-border" />
                                    <div className="inline-flex rounded-md border border-input bg-background">
                                      <button
                                        type="button"
                                        onClick={() => updateSegmentMode(segmentIndex, "car")}
                                        className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
                                          mode === "car"
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-muted"
                                        }`}
                                        title="Drive"
                                      >
                                        <Car className="h-3 w-3" />
                                        <span>Drive</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateSegmentMode(segmentIndex, "air")}
                                        className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors border-l border-input ${
                                          mode === "air"
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-muted"
                                        }`}
                                        title="Fly"
                                      >
                                        <Plane className="h-3 w-3" />
                                        <span>Fly</span>
                                      </button>
                                    </div>
                                    <div className="h-px flex-1 bg-border" />
                                  </div>
                                  {distanceMiles > 0 && (
                                    <span className="text-[11px] text-muted-foreground mt-0.5">
                                      {distanceMiles.toLocaleString()} mi
                                    </span>
                                  )}
                                </div>
                              );
                            };
                            return (
                              <>
                                {editingStartLocation ? (
                                  <div className="rounded border border-primary/30 bg-primary/5 p-2 space-y-1">
                                    <Label className="text-xs font-medium text-primary">Start location</Label>
                                    <PlaceAutocomplete
                                      value={startLocationSearch}
                                      onChange={setStartLocationSearch}
                                      onSelect={(place) => updateLocation("start", place)}
                                      placeholder="Search city or address..."
                                      className="mt-1"
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="mt-1"
                                      onClick={() => { setEditingStartLocation(false); setStartLocationSearch(""); }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : itinerary.start_location ? (
                                  <>
                                    <div className="flex items-center gap-2 rounded border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                                      <span className="text-xs font-medium text-primary">Start</span>
                                      <span className="flex-1 text-muted-foreground">{itinerary.start_location}</span>
                                      <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={() => setEditingStartLocation(true)}
                                        title="Edit start location"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    {(itinerary.games.length > 0 || itinerary.end_location) && renderSegmentSelector(segIdx++)}
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full border-dashed text-muted-foreground"
                                    onClick={() => setEditingStartLocation(true)}
                                  >
                                    <MapPin className="h-3.5 w-3.5 mr-1.5" />
                                    Add start location
                                  </Button>
                                )}
                                {itinerary.games.length === 0 && (
                                  <div className="text-center py-8 space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                      Add games from the left panel or auto-generate an optimized route
                                    </p>
                                    <Button
                                      onClick={handleAutoGenerate}
                                      disabled={autoGenerating}
                                      className="gap-2"
                                    >
                                      {autoGenerating ? (
                                        <>
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          Generating...
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="h-4 w-4" />
                                          Auto Generate Itinerary
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                )}
                                {itinerary.games.map((g, index) => {
                                  const stopoversAfter = (itinerary.stopovers ?? []).filter((s) => s.after_index === index).sort((a, b) => a.sort_order - b.sort_order);
                                  const isRemoving = removingGameId === g.game_id;
                                  return (
                                    <div key={g.game_id} className="space-y-1">
                                      <Draggable draggableId={String(g.game_id)} index={index} isDragDisabled={isRemoving}>
                                        {(prov, snap) => (
                                          <div
                                            ref={prov.innerRef}
                                            {...prov.draggableProps}
                                            {...prov.dragHandleProps}
                                            className={`flex items-center justify-between p-2 rounded border text-sm cursor-pointer transition-opacity ${
                                              snap.isDragging ? "bg-accent/20 border-accent" : "bg-card hover:bg-muted/50"
                                            } ${isRemoving ? "opacity-50" : ""}`}
                                            onClick={() => !isRemoving && setSelectedGame(g)}
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-muted-foreground w-5">{index + 1}</span>
                                              <div>
                                                <div className="font-medium">
                                                  <GameMatchup
                                                    awayTeam={g.away_team}
                                                    homeTeam={g.home_team}
                                                    awayName={g.away_team_name}
                                                    homeName={g.home_team_name}
                                                    size={20}
                                                  />
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  {g.stadium_name} &middot; {g.city}, {g.state}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  {formatDate(g.date_time, g.home_team)} {formatTime(g.date_time, g.home_team)}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className={g.locked ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-foreground"}
                                                onClick={(e) => { e.stopPropagation(); toggleLock(g.game_id, !g.locked); }}
                                                title={g.locked ? "Unlock game" : "Lock game"}
                                              >
                                                {g.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                              </Button>
                                              {!g.locked && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="text-red-500 hover:text-red-700"
                                                  onClick={(e) => { e.stopPropagation(); removeGame(g.game_id); }}
                                                  disabled={isRemoving}
                                                >
                                                  {isRemoving ? "Removing..." : "Remove"}
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                      {stopoversAfter.length > 0 && renderSegmentSelector(segIdx++)}
                                      {stopoversAfter.map((s) => (
                                        <div key={s.id} className="space-y-1">
                                          <div className="flex items-center justify-between rounded border border-dashed border-muted bg-muted/30 px-3 py-2 text-sm">
                                            <div className="flex items-center gap-2">
                                              <MapPin className="h-4 w-4 text-muted-foreground" />
                                              <span className="text-muted-foreground">{s.label}</span>
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="text-red-500 hover:text-red-700"
                                              onClick={() => removeStopover(s.id)}
                                            >
                                              Remove
                                            </Button>
                                          </div>
                                          {renderSegmentSelector(segIdx++)}
                                        </div>
                                      ))}
                                      {/* Only show add stopover option if no stopover exists for this segment */}
                                      {stopoversAfter.length === 0 && (
                                        stopoverAddingAfterIndex === index ? (
                                          <div className="rounded border border-muted bg-muted/20 p-2">
                                            <Label className="text-xs">Search for a stopover</Label>
                                            <PlaceAutocomplete
                                              value={stopoverSearchValue}
                                              onChange={setStopoverSearchValue}
                                              onSelect={(place) => addStopover(index, place)}
                                              placeholder="City or address..."
                                              className="mt-1"
                                            />
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="mt-2"
                                              onClick={() => {
                                                setStopoverAddingAfterIndex(null);
                                                setStopoverSearchValue("");
                                              }}
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full border-dashed text-muted-foreground"
                                            onClick={() => setStopoverAddingAfterIndex(index)}
                                          >
                                            <MapPin className="h-3.5 w-3.5 mr-1.5" />
                                            Add stopover
                                          </Button>
                                        )
                                      )}
                                      {/* Only render segment selector here if there are no stopovers (stopovers have their own selector after them) */}
                                      {stopoversAfter.length === 0 && (index < itinerary.games.length - 1 || itinerary.end_location) && renderSegmentSelector(segIdx++)}
                                    </div>
                                  );
                                })}
                                {editingEndLocation ? (
                                  <div className="rounded border border-primary/30 bg-primary/5 p-2 space-y-1">
                                    <Label className="text-xs font-medium text-primary">End location</Label>
                                    <PlaceAutocomplete
                                      value={endLocationSearch}
                                      onChange={setEndLocationSearch}
                                      onSelect={(place) => updateLocation("end", place)}
                                      placeholder="Search city or address..."
                                      className="mt-1"
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="mt-1"
                                      onClick={() => { setEditingEndLocation(false); setEndLocationSearch(""); }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : itinerary.end_location ? (
                                  <div className="flex items-center gap-2 rounded border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                                    <span className="text-xs font-medium text-primary">Finish</span>
                                    <span className="flex-1 text-muted-foreground">{itinerary.end_location}</span>
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-foreground transition-colors"
                                      onClick={() => setEditingEndLocation(true)}
                                      title="Edit end location"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full border-dashed text-muted-foreground"
                                    onClick={() => setEditingEndLocation(true)}
                                  >
                                    <MapPin className="h-3.5 w-3.5 mr-1.5" />
                                    Add end location
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      {provided.placeholder}
                    </ScrollArea>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </CardContent>
        </Card>
      </div>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Itinerary</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{itinerary.name}"? This action cannot be undone and will remove all games from this itinerary.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GameDetailPanel
        game={selectedGame}
        open={selectedGame !== null}
        onClose={() => setSelectedGame(null)}
        itineraryId={id}
        onNotesChange={(gameId, notes) => {
          setItinerary((prev) => prev ? {
            ...prev,
            games: prev.games.map((g) => g.game_id === gameId ? { ...g, notes } : g),
          } : prev);
        }}
        onLockedChange={(gameId, locked) => {
          toggleLock(gameId, locked);
          setSelectedGame((prev) => prev && prev.game_id === gameId ? { ...prev, locked } : prev);
        }}
      />

      {/* Regenerate confirmation dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Itinerary</DialogTitle>
            <DialogDescription>
              {(() => {
                const lockedCount = itinerary.games.filter((g) => g.locked).length;
                if (lockedCount > 0) {
                  return `This will replace all unlocked games with a new auto-generated route. Your ${lockedCount} locked game${lockedCount > 1 ? "s" : ""} will be preserved.`;
                }
                return `This will replace all ${itinerary.games.length} existing games with a new auto-generated route. This action cannot be undone.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRegenerateDialogOpen(false)}
              disabled={autoGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAutoGenerate}
              disabled={autoGenerating}
              className="gap-2"
            >
              {autoGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Regenerate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-generate result dialog */}
      <Dialog open={autoGenerateResult !== null} onOpenChange={(open) => { if (!open) setAutoGenerateResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Itinerary Generated</DialogTitle>
          </DialogHeader>
          {autoGenerateResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{autoGenerateResult.parks_covered}</div>
                  <div className="text-xs text-muted-foreground">of {autoGenerateResult.total_parks} parks</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{autoGenerateResult.estimated_days}</div>
                  <div className="text-xs text-muted-foreground">days</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{autoGenerateResult.total_distance_miles.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">miles</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{autoGenerateResult.games_added}</div>
                  <div className="text-xs text-muted-foreground">games</div>
                </div>
              </div>
              {autoGenerateResult.infeasible_parks.length > 0 && (
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm">
                  <p className="font-medium text-yellow-800">
                    {autoGenerateResult.infeasible_parks.length} park{autoGenerateResult.infeasible_parks.length > 1 ? "s" : ""} could not be scheduled:
                  </p>
                  <p className="text-yellow-700 mt-1">
                    {autoGenerateResult.infeasible_parks.join(", ")}
                  </p>
                  <p className="text-yellow-600 text-xs mt-1">
                    No home games were available in the date window. Try an earlier start date or add these manually.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setAutoGenerateResult(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as Template dialog (admin only) */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              This template will be used to pre-populate new user accounts with an example itinerary.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. East Coast Classic"
              />
            </div>
            <div>
              <Label htmlFor="template-description">Description (optional)</Label>
              <textarea
                id="template-description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="A brief description of this template..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            {templateSaved && (
              <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-3 text-sm text-green-800 dark:text-green-300">
                Template saved successfully! You can manage it from the admin Templates page.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              {templateSaved ? "Close" : "Cancel"}
            </Button>
            {!templateSaved && (
              <Button
                onClick={async () => {
                  if (!templateName.trim()) return;
                  setSavingTemplate(true);
                  try {
                    const res = await fetch("/api/admin/templates", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        source_itinerary_id: id,
                        name: templateName.trim(),
                        description: templateDescription.trim() || undefined,
                      }),
                    });
                    if (res.ok) {
                      setTemplateSaved(true);
                    }
                  } finally {
                    setSavingTemplate(false);
                  }
                }}
                disabled={savingTemplate || !templateName.trim()}
              >
                {savingTemplate ? "Saving..." : "Save Template"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
