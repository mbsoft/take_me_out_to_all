"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Shield, ShieldOff, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  has_password: boolean;
  itinerary_count: number;
}

interface Itinerary {
  id: string;
  name: string;
  goal: string;
  travel_mode: string;
  start_location: string | null;
  start_date: string | null;
  created_at: string;
  game_count: number;
}

export default function AdminUserDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
  }, [status, router]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/users/${userId}`).then((r) => r.json()),
      fetch(`/api/admin/users/${userId}/itineraries`).then((r) => r.json()),
    ]).then(([userData, itData]) => {
      setUser(userData);
      setItineraries(itData.itineraries || []);
      setLoading(false);
    });
  }, [userId]);

  async function toggleActive() {
    await fetch(`/api/admin/users/${userId}/toggle-active`, { method: "POST" });
    const res = await fetch(`/api/admin/users/${userId}`);
    setUser(await res.json());
  }

  async function toggleRole() {
    if (!user) return;
    const newRole = user.role === "admin" ? "user" : "admin";
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const res = await fetch(`/api/admin/users/${userId}`);
    setUser(await res.json());
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    router.push("/admin/users");
  }

  function handleExport() {
    window.open(`/api/admin/users/${userId}/export`, "_blank");
  }

  if (loading || !user) {
    return <p className="text-center py-12 text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">User Details</h1>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{user.name || user.email}</h2>
              {user.name && <p className="text-sm text-muted-foreground">{user.email}</p>}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
                <Badge variant={user.is_active ? "outline" : "destructive"}>
                  {user.is_active ? "Active" : "Disabled"}
                </Badge>
                <Badge variant="outline">
                  {user.has_password ? "Email login" : "Google OAuth"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Joined {new Date(user.created_at).toLocaleDateString()} &middot; {user.itinerary_count} itineraries
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={toggleActive}>
                {user.is_active ? (
                  <><UserX className="h-4 w-4 mr-1" /> Disable</>
                ) : (
                  <><UserCheck className="h-4 w-4 mr-1" /> Enable</>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={toggleRole}>
                {user.role === "admin" ? (
                  <><ShieldOff className="h-4 w-4 mr-1" /> Demote</>
                ) : (
                  <><Shield className="h-4 w-4 mr-1" /> Promote</>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete User
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itineraries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Itineraries ({itineraries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {itineraries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No itineraries</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Games</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itineraries.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <Link href={`/itinerary/${it.id}`} className="hover:underline font-medium">
                        {it.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{it.goal}</Badge>
                    </TableCell>
                    <TableCell>{it.game_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {it.start_location || "Not set"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(it.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Permanently delete {user.email} and all their data? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
