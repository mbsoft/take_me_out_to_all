"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  travel_mode: string;
  is_active: boolean;
  game_count: number;
  creator_email: string;
  created_at: string;
}

export default function AdminTemplatesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 20;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
  }, [status, router]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);

    const res = await fetch(`/api/admin/templates?${params}`);
    const data = await res.json();
    setTemplates(data.templates || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  async function handleToggleActive(id: string) {
    const res = await fetch(`/api/admin/templates/${id}/toggle-active`, { method: "POST" });
    if (res.ok) {
      const { is_active } = await res.json();
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active } : t))
      );
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/templates/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteId(null);
      loadTemplates();
    }
    setDeleting(false);
  }

  const totalPages = Math.ceil(total / limit);
  const deleteName = templates.find((t) => t.id === deleteId)?.name || "";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Itinerary Templates</h1>
      <p className="text-muted-foreground text-sm">
        Active templates are automatically seeded into new user accounts as example itineraries.
      </p>

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
                <TableHead>Description</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Games</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No templates found. Save an itinerary as a template from the itinerary builder.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {t.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.goal}</Badge>
                    </TableCell>
                    <TableCell>{t.game_count}</TableCell>
                    <TableCell>
                      <Switch
                        checked={t.is_active}
                        onCheckedChange={() => handleToggleActive(t.id)}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                {total} template{total !== 1 ? "s" : ""} total
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

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteName}&quot;? This will not affect
              itineraries that were already seeded from this template.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
