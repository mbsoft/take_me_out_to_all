"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, ExternalLink, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { goalLabel as getGoalLabel, filterTeamsByGoal } from "@/lib/goal-utils";
import { getTeamLogoPath } from "@/lib/team-logos";

interface Itinerary {
  id: string;
  name: string;
  goal: string;
  travel_mode: string;
  game_count: number;
  updated_at: string;
  custom_teams?: string[] | null;
}

interface NewsArticle {
  headline: string;
  description: string;
  published: string;
  images?: { url: string; width: number; height: number }[];
  links?: { web?: { href: string } };
}

interface ScoreboardEvent {
  id: string;
  name: string;
  shortName: string;
  date: string;
  status: {
    type: { name: string; completed: boolean };
    displayClock: string;
    shortDetail: string;
  };
  competitions: {
    venue?: { fullName: string; address?: { city?: string } };
    competitors: {
      homeAway: string;
      score: string;
      team: { displayName: string; abbreviation: string; logo: string };
    }[];
  }[];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itineraryToDelete, setItineraryToDelete] = useState<Itinerary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [events, setEvents] = useState<ScoreboardEvent[]>([]);
  const [teams, setTeams] = useState<Array<{ abbr: string; league?: string }>>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/itineraries")
        .then((r) => r.json())
        .then((data) => {
          setItineraries(data);
          setLoading(false);
          if (Array.isArray(data) && !sessionStorage.getItem("skip_onboarding")) {
            const userCreated = data.filter((it: Itinerary) => !it.name.startsWith("Example: "));
            if (userCreated.length === 0) {
              router.push("/onboarding");
            }
          }
        });
    }
  }, [status]);

  // Fetch teams for goal icons
  useEffect(() => {
    fetch("/api/teams").then((r) => r.json()).then(setTeams).catch(() => {});
  }, []);

  // Fetch ESPN MLB news
  useEffect(() => {
    fetch("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news")
      .then((r) => r.json())
      .then((data) => setNews(data.articles?.slice(0, 10) || []))
      .catch(() => {});
  }, []);

  // Fetch ESPN MLB scoreboard
  useEffect(() => {
    fetch("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard")
      .then((r) => r.json())
      .then((data) => setEvents(data.events?.slice(0, 12) || []))
      .catch(() => {});
  }, []);

  if (status === "loading" || loading) {
    return <p className="text-center py-12 text-muted-foreground">Loading...</p>;
  }

  const goalLabelFor = (it: Itinerary) => getGoalLabel(it.goal, it.custom_teams);

  const handleDeleteClick = (e: React.MouseEvent, itinerary: Itinerary) => {
    e.preventDefault();
    e.stopPropagation();
    setItineraryToDelete(itinerary);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itineraryToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/itineraries/${itineraryToDelete.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setItineraries(itineraries.filter((it) => it.id !== itineraryToDelete.id));
        setDeleteDialogOpen(false);
        setItineraryToDelete(null);
      }
    } catch (error) {
      console.error("Failed to delete itinerary:", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative w-[100vw] left-1/2 -translate-x-1/2 px-4">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6">
        {/* Left sidebar: MLB News */}
        <aside className="hidden lg:block">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">MLB News</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-180px)]">
                <div className="space-y-0 divide-y">
                  {news.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 px-4">Loading news...</p>
                  ) : (
                    news.map((article, i) => {
                      const imageUrl = article.images?.[0]?.url;
                      const articleUrl = article.links?.web?.href;
                      const timeAgo = getTimeAgo(article.published);
                      return (
                        <a
                          key={i}
                          href={articleUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          {imageUrl && (
                            <img
                              src={imageUrl}
                              alt=""
                              className="w-full h-32 object-cover rounded mb-2"
                            />
                          )}
                          <p className="text-sm font-medium leading-snug line-clamp-2">
                            {article.headline}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {article.description}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo}</p>
                        </a>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
              <div className="border-t px-4 py-2">
                <a
                  href="https://www.espn.com/mlb/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  More on ESPN <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Center: Itineraries */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Your Itineraries</h1>
            <div className="flex items-center gap-2">
              {session?.user?.role === "admin" && (
                <Link href="/admin">
                  <Button variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
              <Link href="/itinerary/new">
                <Button>New Itinerary</Button>
              </Link>
            </div>
          </div>
          {itineraries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No itineraries yet. Create your first one!
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {itineraries.map((it) => (
                <Card key={it.id} className="hover:bg-muted/50 transition-colors">
                  <Link href={`/itinerary/${it.id}`} className="block">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{it.name}</CardTitle>
                        <div className="flex gap-2">
                          <Badge variant="secondary">{goalLabelFor(it)}</Badge>
                          <Badge variant="outline">{it.travel_mode}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {it.game_count} game{it.game_count !== 1 ? "s" : ""} planned
                      </p>
                      {teams.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {filterTeamsByGoal(teams, it.goal, it.custom_teams).map((t) => {
                            const logo = getTeamLogoPath(t.abbr);
                            return logo ? (
                              <img key={t.abbr} src={logo} alt={t.abbr} className="h-5 w-5" title={t.abbr} />
                            ) : null;
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Link>
                  <div className="px-6 pb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDeleteClick(e, it)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Mobile news + scores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
            {news.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">MLB News</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {news.slice(0, 4).map((article, i) => {
                    const articleUrl = article.links?.web?.href;
                    return (
                      <a
                        key={i}
                        href={articleUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:text-primary transition-colors"
                      >
                        <p className="text-sm font-medium leading-snug line-clamp-2">
                          {article.headline}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {getTimeAgo(article.published)}
                        </p>
                      </a>
                    );
                  })}
                  <a
                    href="https://www.espn.com/mlb/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    More on ESPN <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            )}
            {events.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">MLB Scores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {events.slice(0, 5).map((ev) => {
                    const comp = ev.competitions[0];
                    if (!comp) return null;
                    const away = comp.competitors.find((c) => c.homeAway === "away");
                    const home = comp.competitors.find((c) => c.homeAway === "home");
                    if (!away || !home) return null;
                    return (
                      <div key={ev.id} className="flex items-center justify-between text-sm py-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <img src={away.team.logo} alt="" className="h-4 w-4" />
                            <span className="truncate">{away.team.abbreviation}</span>
                            <span className="ml-auto font-medium">{away.score}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <img src={home.team.logo} alt="" className="h-4 w-4" />
                            <span className="truncate">{home.team.abbreviation}</span>
                            <span className="ml-auto font-medium">{home.score}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground ml-3 shrink-0 w-16 text-right">
                          {ev.status?.shortDetail?.split(" - ").pop() ?? ""}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right sidebar: MLB Scores */}
        <aside className="hidden lg:block">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">MLB Scores</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-180px)]">
                <div className="divide-y">
                  {events.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 px-4">
                      No games scheduled
                    </p>
                  ) : (
                    events.map((ev) => {
                      const comp = ev.competitions[0];
                      if (!comp) return null;
                      const away = comp.competitors.find((c) => c.homeAway === "away");
                      const home = comp.competitors.find((c) => c.homeAway === "home");
                      if (!away || !home) return null;
                      const isLive = ev.status.type.name === "STATUS_IN_PROGRESS";
                      const isFinal = ev.status.type.completed;
                      const gameDate = formatGameDateTime(ev.date);
                      return (
                        <div key={ev.id} className="px-4 py-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-medium ${isLive ? "text-red-500" : "text-muted-foreground"}`}>
                              {ev.status?.shortDetail ?? ""}
                            </span>
                          </div>
                          {gameDate && (
                            <p className="text-xs text-muted-foreground/60">{gameDate}</p>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                <img src={away.team.logo} alt="" className="h-5 w-5 shrink-0" />
                                <span className={`truncate ${isFinal && Number(away.score) > Number(home.score) ? "font-bold" : ""}`}>
                                  {away.team.displayName}
                                </span>
                              </div>
                              <span className={`font-mono text-sm ${isFinal && Number(away.score) > Number(home.score) ? "font-bold" : ""}`}>
                                {away.score}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                <img src={home.team.logo} alt="" className="h-5 w-5 shrink-0" />
                                <span className={`truncate ${isFinal && Number(home.score) > Number(away.score) ? "font-bold" : ""}`}>
                                  {home.team.displayName}
                                </span>
                              </div>
                              <span className={`font-mono text-sm ${isFinal && Number(home.score) > Number(away.score) ? "font-bold" : ""}`}>
                                {home.score}
                              </span>
                            </div>
                          </div>
                          {comp.venue && (
                            <p className="text-xs text-muted-foreground/60">
                              {comp.venue.fullName}{comp.venue.address?.city ? ` · ${comp.venue.address.city}` : ""}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
              <div className="border-t px-4 py-2">
                <a
                  href="https://www.espn.com/mlb/scoreboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  Full scoreboard <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Itinerary</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{itineraryToDelete?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setItineraryToDelete(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
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

function formatGameDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) + " · " + d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getTimeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}
