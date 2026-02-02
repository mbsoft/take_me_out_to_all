"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameMatchup } from "@/components/team-logo";
import { ExternalLink, Ticket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Game {
  game_id: number;
  away_team: string;
  home_team: string;
  away_team_name?: string;
  home_team_name?: string;
  stadium_name?: string;
  city?: string;
  state?: string;
  date_time: string;
}

interface SeatGeekEvent {
  id: number;
  title: string;
  url: string;
  datetime_local: string;
  venue: { name: string; city: string; state: string };
  stats: {
    lowest_price: number | null;
    average_price: number | null;
    highest_price: number | null;
    listing_count: number | null;
  };
  performers: Array<{ name: string; image: string; slug: string }>;
}

interface GameDetailDialogProps {
  game: Game | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(dt: string) {
  const d = new Date(dt);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatTime(dt: string) {
  const d = new Date(dt);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatPrice(price: number | null) {
  if (price == null) return "—";
  return `$${price}`;
}

export function GameDetailDialog({ game, open, onOpenChange }: GameDetailDialogProps) {
  const [event, setEvent] = useState<SeatGeekEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!game || !open) {
      setEvent(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      home_team: game.home_team,
      away_team: game.away_team,
      date_time: game.date_time,
    });

    fetch(`/api/seatgeek?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.events?.length > 0) {
          setEvent(data.events[0]);
        } else {
          setError("No ticket listings found for this game.");
        }
      })
      .catch(() => setError("Failed to load ticket information."))
      .finally(() => setLoading(false));
  }, [game, open]);

  if (!game) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Game Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Matchup */}
          <div className="text-center">
            <div className="text-lg font-semibold">
              <GameMatchup
                awayTeam={game.away_team}
                homeTeam={game.home_team}
                awayName={game.away_team_name}
                homeName={game.home_team_name}
                size={28}
              />
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {game.stadium_name} &middot; {game.city}, {game.state}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDate(game.date_time)} &middot; {formatTime(game.date_time)}
            </div>
          </div>

          {/* Ticket info */}
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading tickets...</span>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              {error}
            </div>
          )}

          {event && !loading && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Lowest</div>
                  <div className="text-lg font-bold text-green-600">
                    {formatPrice(event.stats.lowest_price)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Average</div>
                  <div className="text-lg font-bold">
                    {formatPrice(event.stats.average_price)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Highest</div>
                  <div className="text-lg font-bold text-red-500">
                    {formatPrice(event.stats.highest_price)}
                  </div>
                </div>
              </div>

              {event.stats.listing_count != null && (
                <p className="text-xs text-center text-muted-foreground">
                  {event.stats.listing_count} listings available
                </p>
              )}

              <Button asChild className="w-full">
                <a href={event.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Tickets on SeatGeek
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
