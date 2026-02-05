"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PlaceAutocomplete, type PlaceResult } from "@/components/place-autocomplete";
import { TeamPicker } from "@/components/team-picker";
import { goalLabel } from "@/lib/goal-utils";
import {
  Car,
  Plane,
  ArrowRightLeft,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Trophy,
} from "lucide-react";

const STEPS = ["Welcome", "Name & Goal", "Travel & Schedule", "Review"];

const GOAL_OPTIONS = [
  { value: "all", label: "All 30 Ballparks", desc: "Visit every MLB park" },
  { value: "al", label: "American League", desc: "15 AL ballparks" },
  { value: "nl", label: "National League", desc: "15 NL ballparks" },
  { value: "custom", label: "Custom Selection", desc: "Pick your own" },
];

const TRAVEL_OPTIONS = [
  { value: "drive", label: "Drive", icon: Car, desc: "Road trip all the way" },
  { value: "fly", label: "Fly", icon: Plane, desc: "Fly between cities" },
  { value: "mixed", label: "Mixed", icon: ArrowRightLeft, desc: "Fly when > 500 mi" },
];

export default function OnboardingPage() {
  const { status } = useSession();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [checking, setChecking] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("all");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [travelMode, setTravelMode] = useState("mixed");
  const [startDate, setStartDate] = useState("");
  const [startLocation, setStartLocation] = useState("");
  const [startPlace, setStartPlace] = useState<PlaceResult | null>(null);
  const [endLocation, setEndLocation] = useState("");
  const [endPlace, setEndPlace] = useState<PlaceResult | null>(null);

  // Submission
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/itineraries")
        .then((r) => r.json())
        .then((data) => {
          const userCreated = Array.isArray(data)
            ? data.filter((it: { name: string }) => !it.name.startsWith("Example: "))
            : [];
          if (userCreated.length > 0) {
            router.push("/dashboard");
          } else {
            setChecking(false);
          }
        });
    }
  }, [status, router]);

  if (status === "loading" || checking) {
    return <p className="text-center py-12 text-muted-foreground">Loading...</p>;
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return name.trim().length > 0 && (goal !== "custom" || selectedTeams.length > 0);
      case 2:
        return startDate !== "";
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setDirection("forward");
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection("backward");
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSkip = () => {
    sessionStorage.setItem("skip_onboarding", "true");
    router.push("/dashboard");
  };

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/itineraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          goal,
          custom_teams: goal === "custom" ? selectedTeams : null,
          travel_mode: travelMode,
          start_date: startDate || null,
          start_location: startLocation || null,
          start_lat: startPlace?.lat ?? null,
          start_lon: startPlace?.lng ?? null,
          end_location: endLocation || null,
          end_lat: endPlace?.lat ?? null,
          end_lon: endPlace?.lng ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create itinerary");
        setCreating(false);
        return;
      }

      const data = await res.json();
      router.push(`/itinerary/${data.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setCreating(false);
    }
  };

  const progressValue = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 max-w-2xl mx-auto">
      {/* Progress header */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Step {currentStep + 1} of {STEPS.length}
          </span>
          <button onClick={handleSkip} className="hover:underline text-xs">
            Skip for now
          </button>
        </div>
        <Progress value={progressValue} />
      </div>

      {/* Step content */}
      <Card className="w-full">
        <div
          key={currentStep}
          className={`animate-in fade-in duration-300 ${
            direction === "forward" ? "slide-in-from-right-4" : "slide-in-from-left-4"
          }`}
        >
          {currentStep === 0 && (
            <>
              <CardHeader className="text-center pb-2">
                <Image
                  src="/logo.png"
                  alt="Take Me Out to the Ballparks"
                  width={300}
                  height={150}
                  className="mx-auto rounded-3xl opacity-80 drop-shadow-xl"
                  priority
                />
                <CardTitle className="text-2xl mt-4">
                  Welcome to Take Me Out to the Ballparks!
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                <p className="text-muted-foreground">
                  Let&apos;s plan your ultimate ballpark road trip for the 2026 MLB season. In just
                  a few quick steps, we&apos;ll set up your first itinerary.
                </p>
                <div className="flex flex-col gap-3 text-sm text-left max-w-sm mx-auto">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Trophy className="h-4 w-4" />
                    </div>
                    <span>Name your trip and pick your ballpark goal</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Car className="h-4 w-4" />
                    </div>
                    <span>Choose how you&apos;ll travel and when you&apos;ll start</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <span>Review and create your itinerary</span>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle>Name & Goal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Trip Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My 2026 Ballpark Tour"
                  />
                </div>
                <div>
                  <Label>Ballpark Goal</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {GOAL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGoal(opt.value)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          goal === opt.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="font-medium text-sm">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                {goal === "custom" && (
                  <TeamPicker selectedTeams={selectedTeams} onChange={setSelectedTeams} />
                )}
              </CardContent>
            </>
          )}

          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle>Travel & Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Travel Mode</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {TRAVEL_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTravelMode(opt.value)}
                          className={`rounded-lg border p-3 text-center transition-colors ${
                            travelMode === opt.value
                              ? "border-primary bg-primary/10"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <Icon className="h-5 w-5 mx-auto mb-1" />
                          <div className="font-medium text-sm">{opt.label}</div>
                          <div className="text-xs text-muted-foreground">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min="2026-03-25"
                    max="2026-10-04"
                  />
                </div>
                <div>
                  <Label>Start City (optional)</Label>
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
                  <Label>End City (optional)</Label>
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
              </CardContent>
            </>
          )}

          {currentStep === 3 && (
            <>
              <CardHeader>
                <CardTitle>Review Your Itinerary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Trip Name</span>
                    <span className="font-medium">{name}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Goal</span>
                    <Badge variant="secondary">
                      {goalLabel(goal, goal === "custom" ? selectedTeams : null)}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Travel Mode</span>
                    <Badge variant="outline">{travelMode}</Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Start Date</span>
                    <span>{startDate || "Not set"}</span>
                  </div>
                  {startLocation && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Start City</span>
                        <span>{startLocation}</span>
                      </div>
                    </>
                  )}
                  {endLocation && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">End City</span>
                        <span>{endLocation}</span>
                      </div>
                    </>
                  )}
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <p className="text-xs text-muted-foreground text-center">
                  You can always change these settings later from your itinerary page.
                </p>
              </CardContent>
            </>
          )}
        </div>
      </Card>

      {/* Navigation buttons */}
      <div className="flex w-full justify-between">
        {currentStep > 0 ? (
          <Button variant="outline" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        ) : (
          <div />
        )}

        {currentStep < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            {currentStep === 0 ? "Play Ball!" : "Next"}{" "}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={creating || !canProceed()}>
            {creating ? "Creating..." : "Create My Itinerary"}
          </Button>
        )}
      </div>
    </div>
  );
}
