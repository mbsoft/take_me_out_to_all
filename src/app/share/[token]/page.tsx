"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { TeamLogo } from "@/components/team-logo";
import ItineraryMap from "@/components/itinerary-map";
import { teamsData } from "@/lib/teams-data";
import { goalLabel } from "@/lib/goal-utils";
import { getTeamLogoPath } from "@/lib/team-logos";
import { Check, Car, Plane, MapPin, List, Map as MapIcon } from "lucide-react";

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

interface SharedGame {
  game_id: number;
  sort_order: number;
  locked?: boolean;
  day: string;
  date_time: string;
  away_team: string;
  home_team: string;
  stadium_name?: string;
  city?: string;
  state?: string;
  lat?: number;
  lon?: number;
  home_team_name?: string;
  away_team_name?: string;
}

interface SharedItinerary {
  name: string;
  goal: string;
  travel_mode: string;
  start_date?: string;
  start_location?: string;
  start_lat?: number;
  start_lon?: number;
  end_location?: string;
  end_lat?: number;
  end_lon?: number;
  games: SharedGame[];
  stopovers?: any[];
  segment_modes?: string[];
  custom_teams?: string[] | null;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [itinerary, setItinerary] = useState<SharedItinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((r) => {
        if (!r.ok) {
          setNotFound(true);
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setItinerary(data);
          setLoading(false);
        }
      });
  }, [token]);

  if (loading) {
    return <p className="text-center py-12 text-muted-foreground">Loading...</p>;
  }

  if (notFound || !itinerary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h1 className="text-2xl font-bold">Itinerary Not Found</h1>
        <p className="text-muted-foreground">This shared link is no longer available.</p>
        <Link href="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    );
  }

  // Compute progress
  const targetTeams =
    itinerary.goal === "custom" && itinerary.custom_teams
      ? teamsData.filter((t) => itinerary.custom_teams!.includes(t.abbr))
      : itinerary.goal === "al"
        ? teamsData.filter((t) => t.league === "AL")
        : itinerary.goal === "nl"
          ? teamsData.filter((t) => t.league === "NL")
          : teamsData;

  const visitedParks = new Set(itinerary.games.map((g) => g.home_team));
  const totalParks = targetTeams.length;
  const progressPct = totalParks > 0 ? (visitedParks.size / totalParks) * 100 : 0;

  const startLoc =
    itinerary.start_lat && itinerary.start_lon
      ? { lat: itinerary.start_lat, lon: itinerary.start_lon, label: itinerary.start_location }
      : null;
  const endLoc =
    itinerary.end_lat && itinerary.end_lon
      ? { lat: itinerary.end_lat, lon: itinerary.end_lon, label: itinerary.end_location }
      : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{itinerary.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">
              {goalLabel(itinerary.goal, itinerary.custom_teams)}
            </Badge>
            <Badge variant="outline">{itinerary.travel_mode}</Badge>
            {itinerary.games.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {itinerary.games.length} game{itinerary.games.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <Link href="/register">
          <Button variant="outline" size="sm">Plan Your Own Trip</Button>
        </Link>
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
                variant="outline"
                className={`text-xs gap-1 ${!visitedParks.has(t.abbr) ? "opacity-40" : ""}`}
              >
                <TeamLogo abbr={t.abbr} size={16} />
                {visitedParks.has(t.abbr) && <Check className="h-3.5 w-3.5 text-green-600" />}
                {t.abbr}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* View toggle */}
      <div className="flex gap-2">
        <Button
          variant={view === "list" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("list")}
        >
          <List className="h-4 w-4 mr-1" /> List
        </Button>
        <Button
          variant={view === "map" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("map")}
        >
          <MapIcon className="h-4 w-4 mr-1" /> Map
        </Button>
      </div>

      {/* Map view */}
      {view === "map" && (
        <div className="h-[600px] rounded-lg overflow-hidden border">
          <ItineraryMap
            games={itinerary.games.map((g) => ({
              game_id: g.game_id,
              home_team: g.home_team,
              away_team: g.away_team,
              stadium_name: g.stadium_name,
              city: g.city,
              date_time: g.date_time,
              lat: g.lat,
              lon: g.lon,
              locked: g.locked,
            }))}
            stopovers={itinerary.stopovers}
            segmentModes={itinerary.segment_modes}
            startLocation={startLoc}
            endLocation={endLoc}
            travelMode={itinerary.travel_mode}
            allTeams={targetTeams.map((t) => ({
              abbr: t.abbr,
              lat: t.lat,
              lon: t.lon,
              stadium_name: t.stadium_name,
            }))}
            visitedParks={visitedParks}
            shareToken={token}
          />
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <Card>
          <CardContent className="py-4">
            {/* Start location */}
            {itinerary.start_location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 pb-3 border-b">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>Start: {itinerary.start_location}</span>
              </div>
            )}

            <div className="space-y-0">
              {itinerary.games.map((game, idx) => (
                <div key={game.game_id}>
                  {/* Segment mode indicator */}
                  {idx > 0 && itinerary.segment_modes && itinerary.segment_modes[idx] && (
                    <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                      {itinerary.segment_modes[idx] === "air" ? (
                        <Plane className="h-3 w-3 mr-1" />
                      ) : (
                        <Car className="h-3 w-3 mr-1" />
                      )}
                      {itinerary.segment_modes[idx] === "air" ? "Fly" : "Drive"}
                    </div>
                  )}
                  {idx === 0 && itinerary.segment_modes && itinerary.segment_modes[0] && (
                    <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                      {itinerary.segment_modes[0] === "air" ? (
                        <Plane className="h-3 w-3 mr-1" />
                      ) : (
                        <Car className="h-3 w-3 mr-1" />
                      )}
                      {itinerary.segment_modes[0] === "air" ? "Fly" : "Drive"}
                    </div>
                  )}

                  {/* Game card */}
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <span className="text-lg font-bold text-muted-foreground w-8 text-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <img
                        src={getTeamLogoPath(game.away_team) || ""}
                        alt={game.away_team}
                        className="h-6 w-6"
                      />
                      <span className="text-xs text-muted-foreground">@</span>
                      <img
                        src={getTeamLogoPath(game.home_team) || ""}
                        alt={game.home_team}
                        className="h-6 w-6"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">
                        {game.away_team_name || game.away_team} @ {game.home_team_name || game.home_team}
                      </div>
                      {game.stadium_name && (
                        <div className="text-xs text-muted-foreground">
                          {game.stadium_name}{game.city ? `, ${game.city}` : ""}
                          {game.state ? `, ${game.state}` : ""}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm shrink-0">
                      <div className="font-medium">
                        {formatDate(game.date_time, game.home_team)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(game.date_time, game.home_team)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* End segment + location */}
              {itinerary.end_location && itinerary.segment_modes && itinerary.segment_modes.length > itinerary.games.length && (
                <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                  {itinerary.segment_modes[itinerary.games.length] === "air" ? (
                    <Plane className="h-3 w-3 mr-1" />
                  ) : (
                    <Car className="h-3 w-3 mr-1" />
                  )}
                  {itinerary.segment_modes[itinerary.games.length] === "air" ? "Fly" : "Drive"}
                </div>
              )}
              {itinerary.end_location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3 pt-3 border-t">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>End: {itinerary.end_location}</span>
                </div>
              )}
            </div>

            {itinerary.games.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No games added to this itinerary yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
