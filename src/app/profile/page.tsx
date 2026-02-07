"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TeamLogo } from "@/components/team-logo";
import { Check, Loader2, AlertTriangle } from "lucide-react";

interface UserData {
  id: string;
  email: string;
  name: string | null;
  hasPassword: boolean;
  createdAt: string;
}

interface VisitedPark {
  team_abbr: string;
  visited_at: string | null;
  notes: string | null;
}

interface Team {
  abbr: string;
  name: string;
  stadium_name: string;
  city: string;
  state: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [visitedParks, setVisitedParks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete account state
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      Promise.all([
        fetch("/api/user").then((r) => r.json()),
        fetch("/api/user/visited-parks").then((r) => r.json()),
        fetch("/api/teams").then((r) => r.json()),
      ])
        .then(([userData, visitedData, teamsData]) => {
          setUser(userData);
          setVisitedParks(new Set(visitedData.map((v: VisitedPark) => v.team_abbr)));
          setTeams(teamsData);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  const toggleVisited = async (teamAbbr: string) => {
    const isCurrentlyVisited = visitedParks.has(teamAbbr);
    const newVisited = !isCurrentlyVisited;

    // Optimistic update
    setVisitedParks((prev) => {
      const next = new Set(prev);
      if (newVisited) {
        next.add(teamAbbr);
      } else {
        next.delete(teamAbbr);
      }
      return next;
    });

    try {
      await fetch("/api/user/visited-parks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamAbbr, visited: newVisited }),
      });
    } catch (error) {
      // Revert on error
      setVisitedParks((prev) => {
        const next = new Set(prev);
        if (newVisited) {
          next.delete(teamAbbr);
        } else {
          next.add(teamAbbr);
        }
        return next;
      });
      console.error("Failed to update visited park:", error);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Failed to change password");
      } else {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordError("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;

    setDeleting(true);
    try {
      const res = await fetch("/api/user", { method: "DELETE" });
      if (res.ok) {
        await signOut({ callbackUrl: "/" });
      }
    } catch (error) {
      console.error("Failed to delete account:", error);
      setDeleting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const visitedCount = visitedParks.size;
  const totalParks = teams.length || 30;
  const progressPercent = (visitedCount / totalParks) * 100;

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-4">
      <h1 className="text-3xl font-bold">Profile</h1>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Name</Label>
              <p className="font-medium">{user.name || "Not set"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Sign-in Method</Label>
              <p className="font-medium">{user.hasPassword ? "Email & Password" : "Google"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Member Since</Label>
              <p className="font-medium">
                {new Date(user.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password - Only for credentials users */}
      {user.hasPassword && (
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-green-600">Password changed successfully!</p>
              )}
              <Button type="submit" disabled={changingPassword}>
                {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Ballpark Scorecard */}
      <Card>
        <CardHeader>
          <CardTitle>Ballpark Scorecard</CardTitle>
          <CardDescription>
            Track which MLB ballparks you&apos;ve visited
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {visitedCount} of {totalParks} ballparks visited
              </span>
              <span className="text-muted-foreground">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Teams Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const isVisited = visitedParks.has(team.abbr);
              return (
                <button
                  key={team.abbr}
                  onClick={() => toggleVisited(team.abbr)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
                    isVisited ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <TeamLogo abbr={team.abbr} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{team.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {team.stadium_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {team.city}, {team.state}
                    </p>
                  </div>
                  {isVisited && (
                    <Check className="h-5 w-5 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Account</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete your
                  account and remove all your data, including your itineraries and
                  ballpark visit history.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm">
                  Type <strong>DELETE</strong> to confirm:
                </p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setDeleteConfirmText("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || deleting}
                >
                  {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
