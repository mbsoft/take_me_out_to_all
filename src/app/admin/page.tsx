"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, MapPin, Activity, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  totalItineraries: number;
  totalGamesPlanned: number;
  apiCallsToday: number;
  apiCallsThisWeek: number;
  recentRegistrations: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
  }>;
  recentAuditLog: Array<{
    id: string;
    admin_id: string;
    action: string;
    target_type: string | null;
    target_id: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
  }>;
}

export default function AdminDashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const summaryCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, href: "/admin/users" },
    { label: "Active Users", value: stats.activeUsers, icon: Users, href: "/admin/users" },
    { label: "Itineraries", value: stats.totalItineraries, icon: MapPin, href: "/admin/itineraries" },
    { label: "API Calls Today", value: stats.apiCallsToday, icon: Activity, href: "/admin/monitoring" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                </div>
                <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Registrations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentRegistrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentRegistrations.map((user) => (
                  <div key={user.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{user.name || user.email}</div>
                      {user.name && (
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {user.role === "admin" && <Badge variant="secondary">admin</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Admin accounts</span>
                <span className="font-medium">{stats.adminUsers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Games planned</span>
                <span className="font-medium">{stats.totalGamesPlanned.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API calls this week</span>
                <span className="font-medium">{stats.apiCallsThisWeek.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API calls today</span>
                <span className="font-medium">{stats.apiCallsToday.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Admin Activity */}
        {stats.recentAuditLog.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Recent Admin Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recentAuditLog.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <span className="font-medium">{entry.action}</span>
                      {entry.target_type && (
                        <span className="text-muted-foreground ml-1">
                          on {entry.target_type} {entry.target_id?.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
