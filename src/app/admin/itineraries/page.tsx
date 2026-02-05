"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ItineraryRow {
  id: string;
  name: string;
  goal: string;
  travel_mode: string;
  start_location: string | null;
  start_date: string | null;
  user_id: string;
  owner_email: string;
  owner_name: string | null;
  game_count: number;
  created_at: string;
  updated_at: string;
}

export default function AdminItinerariesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [itineraries, setItineraries] = useState<ItineraryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
  }, [status, router]);

  const loadItineraries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);

    const res = await fetch(`/api/admin/itineraries?${params}`);
    const data = await res.json();
    setItineraries(data.itineraries || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    loadItineraries();
  }, [loadItineraries]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">All Itineraries</h1>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Games</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : itineraries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No itineraries found
                  </TableCell>
                </TableRow>
              ) : (
                itineraries.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <Link href={`/itinerary/${it.id}`} className="hover:underline font-medium">
                        {it.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/users/${it.user_id}`} className="hover:underline text-sm">
                        {it.owner_name || it.owner_email}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{it.goal}</Badge>
                    </TableCell>
                    <TableCell>{it.game_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(it.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                {total} itinerar{total !== 1 ? "ies" : "y"} total
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">Page {page} of {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
