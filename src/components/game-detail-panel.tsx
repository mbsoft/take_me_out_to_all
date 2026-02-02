"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { GameMatchup } from "@/components/team-logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, Ticket, Loader2, X, StickyNote, Check, Camera, Plus, Trash2 } from "lucide-react";

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
  notes?: string;
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

interface Photo {
  id: string;
  file_name: string;
  url: string;
  created_at: string;
}

interface GameDetailPanelProps {
  game: Game | null;
  open: boolean;
  onClose: () => void;
  itineraryId: string;
  onNotesChange?: (gameId: number, notes: string) => void;
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
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
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

function formatPrice(price: number | null) {
  if (price == null) return "—";
  return `$${price}`;
}

export function GameDetailPanel({ game, open, onClose, itineraryId, onNotesChange }: GameDetailPanelProps) {
  const [event, setEvent] = useState<SeatGeekEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);

  // Sync notes from game prop when game changes
  useEffect(() => {
    setNotes(game?.notes ?? "");
    setSaveStatus("idle");
  }, [game?.game_id, game?.notes]);

  // Fetch photos when game changes
  useEffect(() => {
    if (!game || !open) {
      setPhotos([]);
      return;
    }
    setPhotosLoading(true);
    fetch(`/api/itineraries/${itineraryId}/games/${game.game_id}/photos`)
      .then((r) => r.json())
      .then((data) => setPhotos(data.photos ?? []))
      .catch(() => setPhotos([]))
      .finally(() => setPhotosLoading(false));
  }, [game?.game_id, open, itineraryId, game]);

  // Fetch SeatGeek data
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

  const saveNotes = useCallback(
    (value: string) => {
      if (!game) return;
      setSaveStatus("saving");
      fetch(`/api/itineraries/${itineraryId}/games/${game.game_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      })
        .then(() => {
          setSaveStatus("saved");
          onNotesChange?.(game.game_id, value);
          setTimeout(() => setSaveStatus("idle"), 2000);
        })
        .catch(() => setSaveStatus("idle"));
    },
    [game, itineraryId, onNotesChange]
  );

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNotes(value), 1000);
  };

  const handleNotesBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (game && notes !== (game.notes ?? "")) {
      saveNotes(notes);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !game) return;
    e.target.value = ""; // reset so same file can be re-selected

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/itineraries/${itineraryId}/games/${game.game_id}/photos`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.photo) {
        setPhotos((prev) => [...prev, data.photo]);
      }
    } catch {
      // silently fail
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!game) return;
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    await fetch(`/api/itineraries/${itineraryId}/games/${game.game_id}/photos/${photoId}`, {
      method: "DELETE",
    }).catch(() => {});
  };

  if (!game) return null;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[400px] max-w-[90vw] bg-card shadow-2xl border-l transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 font-semibold">
              <Ticket className="h-5 w-5" />
              Game Details
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-6 p-4">
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
                  {formatDate(game.date_time, game.home_team)} &middot; {formatTime(game.date_time, game.home_team)}
                </div>
              </div>

              {/* Ticket info */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <Ticket className="h-4 w-4" />
                  Ticket Prices
                </h3>

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

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <StickyNote className="h-4 w-4" />
                    Notes
                  </h3>
                  {saveStatus === "saving" && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Saved
                    </span>
                  )}
                </div>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[120px]"
                  placeholder="Add notes about this game... (parking, food, meetup plans, etc.)"
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  onBlur={handleNotesBlur}
                />
              </div>

              {/* Photos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Camera className="h-4 w-4" />
                    Photos
                  </h3>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    {uploading ? "Uploading..." : "Add Photo"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpload}
                    title="Upload a photo"
                  />
                </div>

                {photosLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!photosLoading && photos.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-md">
                    No photos yet. Add photos from the event!
                  </p>
                )}

                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo) => (
                      <div key={photo.id} className="group relative aspect-square rounded-md overflow-hidden border cursor-pointer" onClick={() => setViewingPhoto(photo)}>
                        <img
                          src={photo.url}
                          alt={photo.file_name}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletePhotoId(photo.id);
                          }}
                          className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Delete photo"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
      {/* Delete photo confirmation */}
      <Dialog open={deletePhotoId !== null} onOpenChange={(open) => { if (!open) setDeletePhotoId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Photo</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this photo? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePhotoId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletePhotoId) handleDeletePhoto(deletePhotoId);
                setDeletePhotoId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo lightbox */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
          onClick={() => setViewingPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setViewingPhoto(null)}
            className="absolute top-4 right-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            title="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={viewingPhoto.url}
            alt={viewingPhoto.file_name}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
