"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Itinerary {
  id: string;
  name: string;
  goal: string;
  travel_mode: string;
  game_count: number;
  updated_at: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itineraryToDelete, setItineraryToDelete] = useState<Itinerary | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        });
    }
  }, [status]);

  if (status === "loading" || loading) {
    return <p className="text-center py-12 text-muted-foreground">Loading...</p>;
  }

  const goalLabel = (g: string) =>
    g === "all" ? "All 30 Parks" : g === "al" ? "AL Parks (15)" : "NL Parks (15)";

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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Itineraries</h1>
        <Link href="/itinerary/new">
          <Button>New Itinerary</Button>
        </Link>
      </div>
      {itineraries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No itineraries yet. Create your first one!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {itineraries.map((it) => (
            <Card key={it.id} className="hover:bg-muted/50 transition-colors">
              <Link href={`/itinerary/${it.id}`} className="block">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{it.name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{goalLabel(it.goal)}</Badge>
                      <Badge variant="outline">{it.travel_mode}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {it.game_count} game{it.game_count !== 1 ? "s" : ""} planned
                  </p>
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
      
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Itinerary</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{itineraryToDelete?.name}"? This action cannot be undone.
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
