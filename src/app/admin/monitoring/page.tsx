"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ApiUsageData {
  summary: { total_calls: number; avg_response_ms: number; error_rate: number };
  by_api: Array<{ api_name: string; total_calls: number; avg_response_ms: number; error_count: number }>;
  daily_breakdown: Array<{ date: string; api_name: string; call_count: number; avg_response_ms: number; error_count: number }>;
  recent_errors: Array<{ timestamp: string; api_name: string; endpoint: string; status_code: number; response_time_ms: number }>;
}

interface AppStats {
  users: { total: number; active: number; registered_today: number; registered_this_week: number };
  itineraries: { total: number; created_today: number; created_this_week: number; avg_games_per_itinerary: number };
  popular_teams: Array<{ team: string; count: number }>;
  popular_goals: { all: number; al: number; nl: number };
}

interface CloudRunInfo {
  project_id: string;
  region: string;
  service_name: string;
  console_url: string;
  logs_url: string;
  node_version: string;
  environment: string;
  uptime_seconds: number;
}

export default function AdminMonitoringPage() {
  const { status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState("7d");
  const [apiUsage, setApiUsage] = useState<ApiUsageData | null>(null);
  const [appStats, setAppStats] = useState<AppStats | null>(null);
  const [cloudRun, setCloudRun] = useState<CloudRunInfo | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
  }, [status, router]);

  useEffect(() => {
    fetch(`/api/admin/monitoring/api-usage?period=${period}`)
      .then((r) => r.json())
      .then(setApiUsage);
  }, [period]);

  useEffect(() => {
    fetch("/api/admin/monitoring/app-stats").then((r) => r.json()).then(setAppStats);
    fetch("/api/admin/monitoring/cloud-run").then((r) => r.json()).then(setCloudRun);
  }, []);

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Monitoring</h1>

      <Tabs defaultValue="api-usage">
        <TabsList>
          <TabsTrigger value="api-usage">API Usage</TabsTrigger>
          <TabsTrigger value="app-stats">Application</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
        </TabsList>

        {/* API Usage Tab */}
        <TabsContent value="api-usage" className="space-y-4 mt-4">
          <div className="flex gap-2">
            {["today", "7d", "30d"].map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? "default" : "outline"}
                onClick={() => setPeriod(p)}
              >
                {p === "today" ? "Today" : p}
              </Button>
            ))}
          </div>

          {apiUsage && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{apiUsage.summary.total_calls.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Total Calls</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{apiUsage.summary.avg_response_ms}ms</div>
                    <div className="text-xs text-muted-foreground">Avg Response</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{apiUsage.summary.error_rate}%</div>
                    <div className="text-xs text-muted-foreground">Error Rate</div>
                  </CardContent>
                </Card>
              </div>

              {/* By API breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">By API</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>API</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Avg (ms)</TableHead>
                        <TableHead className="text-right">Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiUsage.by_api.map((api) => (
                        <TableRow key={api.api_name}>
                          <TableCell className="font-medium">{api.api_name}</TableCell>
                          <TableCell className="text-right">{api.total_calls.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{api.avg_response_ms}</TableCell>
                          <TableCell className="text-right">
                            {api.error_count > 0 ? (
                              <Badge variant="destructive">{api.error_count}</Badge>
                            ) : (
                              "0"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {apiUsage.by_api.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            No API calls in this period
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Recent Errors */}
              {apiUsage.recent_errors.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Recent Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>API</TableHead>
                          <TableHead>Endpoint</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Response (ms)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiUsage.recent_errors.map((err, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(err.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell>{err.api_name}</TableCell>
                            <TableCell className="text-xs">{err.endpoint}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{err.status_code}</Badge>
                            </TableCell>
                            <TableCell>{err.response_time_ms}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* App Stats Tab */}
        <TabsContent value="app-stats" className="space-y-4 mt-4">
          {appStats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{appStats.users.total}</div>
                    <div className="text-xs text-muted-foreground">Total Users</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{appStats.users.registered_this_week}</div>
                    <div className="text-xs text-muted-foreground">New This Week</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{appStats.itineraries.total}</div>
                    <div className="text-xs text-muted-foreground">Itineraries</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{appStats.itineraries.avg_games_per_itinerary}</div>
                    <div className="text-xs text-muted-foreground">Avg Games/Itinerary</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Goal Distribution */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Goal Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(appStats.popular_goals).map(([goal, count]) => {
                        const total = Object.values(appStats.popular_goals).reduce((s, v) => s + v, 0);
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={goal} className="flex items-center gap-3">
                            <span className="text-sm w-20">{goal === "all" ? "All 30" : goal.toUpperCase()}</span>
                            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-12 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Popular Teams */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Popular Teams</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {appStats.popular_teams.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
                    ) : (
                      <div className="space-y-2">
                        {appStats.popular_teams.map((t) => (
                          <div key={t.team} className="flex items-center justify-between text-sm">
                            <span className="font-medium">{t.team}</span>
                            <span className="text-muted-foreground">{t.count} games</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Infrastructure Tab */}
        <TabsContent value="infrastructure" className="space-y-4 mt-4">
          {cloudRun && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cloud Run Service</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Project</span>
                      <span className="font-medium">{cloudRun.project_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Region</span>
                      <span className="font-medium">{cloudRun.region}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium">{cloudRun.service_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Environment</span>
                      <Badge variant="outline">{cloudRun.environment}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Node.js</span>
                      <span className="font-medium">{cloudRun.node_version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Instance Uptime</span>
                      <span className="font-medium">{formatUptime(cloudRun.uptime_seconds)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                <a href={cloudRun.console_url} target="_blank" rel="noopener noreferrer">
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="pt-6 flex items-center gap-3">
                      <ExternalLink className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Cloud Run Metrics</div>
                        <div className="text-xs text-muted-foreground">View in GCP Console</div>
                      </div>
                    </CardContent>
                  </Card>
                </a>
                <a href={cloudRun.logs_url} target="_blank" rel="noopener noreferrer">
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="pt-6 flex items-center gap-3">
                      <ExternalLink className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Cloud Run Logs</div>
                        <div className="text-xs text-muted-foreground">View in GCP Console</div>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
