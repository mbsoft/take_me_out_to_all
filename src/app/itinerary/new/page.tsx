"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlaceAutocomplete, type PlaceResult } from "@/components/place-autocomplete";

export default function NewItineraryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [startLocation, setStartLocation] = useState("");
  const [startPlace, setStartPlace] = useState<PlaceResult | null>(null);
  const [endLocation, setEndLocation] = useState("");
  const [endPlace, setEndPlace] = useState<PlaceResult | null>(null);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/itineraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          goal: form.get("goal"),
          travel_mode: form.get("travel_mode"),
          start_date: form.get("start_date"),
          start_location: startLocation || null,
          start_lat: startPlace?.lat ?? null,
          start_lon: startPlace?.lng ?? null,
          end_location: endLocation || null,
          end_lat: endPlace?.lat ?? null,
          end_lon: endPlace?.lng ?? null,
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        console.error("Failed to create itinerary:", error);
        alert(`Failed to create itinerary: ${error.error || "Unknown error"}`);
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      if (!data.id) {
        console.error("No ID returned from API:", data);
        alert("Failed to create itinerary: No ID returned");
        setLoading(false);
        return;
      }
      
      router.push(`/itinerary/${data.id}`);
    } catch (error) {
      console.error("Error creating itinerary:", error);
      alert("Failed to create itinerary. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create New Itinerary</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Trip Name</Label>
              <Input id="name" name="name" required placeholder="My 2026 Ballpark Tour" />
            </div>
            <div>
              <Label htmlFor="goal">Goal</Label>
              <select
                id="goal"
                name="goal"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue="all"
              >
                <option value="all">All 30 Ballparks</option>
                <option value="al">American League (15)</option>
                <option value="nl">National League (15)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="travel_mode">Travel Mode</Label>
              <select
                id="travel_mode"
                name="travel_mode"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue="mixed"
              >
                <option value="drive">Drive</option>
                <option value="fly">Fly</option>
                <option value="mixed">Mixed (fly &gt; 400 mi)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input 
                id="start_date" 
                name="start_date" 
                type="date" 
                required 
                min="2026-03-25"
                max="2026-10-04"
              />
            </div>
            <div>
              <Label htmlFor="start_location">Start City (optional)</Label>
              <PlaceAutocomplete
                id="start_location"
                value={startLocation}
                onChange={setStartLocation}
                onSelect={(place) => {
                  setStartLocation(place.label);
                  setStartPlace(place);
                }}
                placeholder="New York, NY"
              />
            </div>
            <div>
              <Label htmlFor="end_location">End City (optional)</Label>
              <PlaceAutocomplete
                id="end_location"
                value={endLocation}
                onChange={setEndLocation}
                onSelect={(place) => {
                  setEndLocation(place.label);
                  setEndPlace(place);
                }}
                placeholder="Los Angeles, CA"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Itinerary"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
