"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Trash2, Map, List } from "lucide-react";
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

const ItineraryMap = dynamic(() => import("@/components/itinerary-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] rounded-lg border flex items-center justify-center bg-muted/50">
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

function formatDate(dt: string) {
  const d = new Date(dt);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(dt: string) {
  const d = new Date(dt);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadItinerary = useCallback(async () => {
    const res = await fetch(`/api/itineraries/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setItinerary(data);
    
    // Set start date filter from itinerary's start_date if available
    if (data.start_date) {
      // Convert DATE format (YYYY-MM-DD) to date input format
      const dateStr = data.start_date.split('T')[0]; // Handle both DATE and TIMESTAMPTZ formats
      setStartDate(dateStr);
    }
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
  useEffect(() => {
    if (!itinerary) return;
    fetch(`/api/suggest?itineraryId=${id}`)
      .then((r) => r.json())
      .then((data) => setSuggestions(data.suggestions || []));
  }, [itinerary, id]);

  async function addGame(gameId: number) {
    await fetch(`/api/itineraries/${id}/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_id: gameId }),
    });
    await loadItinerary();
  }

  async function removeGame(gameId: number) {
    await fetch(`/api/itineraries/${id}/games/${gameId}`, { method: "DELETE" });
    await loadItinerary();
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

  if (loading || !itinerary) {
    return <p className="text-center py-12 text-muted-foreground">Loading...</p>;
  }

  const addedGameIds = new Set(itinerary.games.map((g) => g.game_id));
  const visitedParks = new Set(itinerary.games.map((g) => g.home_team));

  const targetTeams = teams.filter((t) => {
    if (itinerary.goal === "al") return t.league === "AL";
    if (itinerary.goal === "nl") return t.league === "NL";
    return true;
  });
  const totalParks = targetTeams.length;
  const progressPct = totalParks > 0 ? (visitedParks.size / totalParks) * 100 : 0;

  const filteredAvailable = availableGames.filter((g) => !addedGameIds.has(g.game_id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{itinerary.name}</h1>
          <p className="text-sm text-muted-foreground">
            {itinerary.goal === "all" ? "All 30 Parks" : itinerary.goal === "al" ? "AL Parks" : "NL Parks"}
            {" "}&middot; {itinerary.travel_mode}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
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
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {visitedParks.size} / {totalParks} ballparks
            </span>
            <span className="text-sm text-muted-foreground">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-3" />
          <div className="flex flex-wrap gap-1 mt-3">
            {targetTeams.map((t) => (
              <Badge
                key={t.abbr}
                variant={visitedParks.has(t.abbr) ? "default" : "outline"}
                className={`text-xs ${
                  visitedParks.has(t.abbr)
                    ? "bg-green-600"
                    : addedGameIds.size > 0
                    ? "opacity-50"
                    : ""
                }`}
              >
                {t.abbr}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Suggested Next Games</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {suggestions.map((s) => (
                <Card key={s.game_id} className="min-w-[200px] flex-shrink-0">
                  <CardContent className="p-3 space-y-1">
                    <div className="font-medium text-sm">
                      {s.away_team} @ {s.home_team}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.stadium_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(s.date_time)} &middot; {s.distance} mi
                    </div>
                    <Button size="sm" className="w-full mt-1" onClick={() => addGame(s.game_id)}>
                      Add
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            startLocation={
              itinerary.start_lat && itinerary.start_lon
                ? { lat: itinerary.start_lat as unknown as number, lon: itinerary.start_lon as unknown as number }
                : null
            }
            endLocation={
              itinerary.end_lat && itinerary.end_lon
                ? { lat: itinerary.end_lat as unknown as number, lon: itinerary.end_lon as unknown as number }
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
            visitedParks={visitedParks}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
      <div className="grid md:grid-cols-2 gap-6">
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
                {filteredAvailable.slice(0, 100).map((g) => (
                  <div
                    key={g.game_id}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted text-sm"
                  >
                    <div>
                      <span className="font-medium">{g.away_team} @ {g.home_team}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDate(g.date_time)} {formatTime(g.date_time)}
                        {isDayGame(g.date_time) && (
                          <Badge variant="outline" className="ml-1 text-[10px] py-0">DAY</Badge>
                        )}
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => addGame(g.game_id)}>
                      + Add
                    </Button>
                  </div>
                ))}
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
            <CardTitle className="text-base">
              Your Itinerary ({itinerary.games.length} games)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="itinerary">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}>
                    <ScrollArea className="h-[500px]">
                      {itinerary.games.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-12">
                          Add games from the left panel to build your itinerary
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {itinerary.games.map((g, index) => (
                            <Draggable
                              key={g.game_id}
                              draggableId={String(g.game_id)}
                              index={index}
                            >
                              {(prov, snap) => (
                                <div
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                  className={`flex items-center justify-between p-2 rounded border text-sm ${
                                    snap.isDragging ? "bg-blue-50 border-blue-300" : "bg-white"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground w-5">
                                      {index + 1}
                                    </span>
                                    <div>
                                      <div className="font-medium">
                                        {g.away_team_name || g.away_team} @{" "}
                                        {g.home_team_name || g.home_team}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {g.stadium_name} &middot; {g.city}, {g.state}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {formatDate(g.date_time)} {formatTime(g.date_time)}
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-700"
                                    onClick={() => removeGame(g.game_id)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                        </div>
                      )}
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
    </div>
  );
}
