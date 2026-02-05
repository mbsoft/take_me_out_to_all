import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const projectId = process.env.GCP_PROJECT_ID || process.env.PROJECT_ID || "takemeout-486217";
  const region = "us-central1";
  const serviceName = "mlb-itinerary-prod";

  return NextResponse.json({
    project_id: projectId,
    region,
    service_name: serviceName,
    console_url: `https://console.cloud.google.com/run/detail/${region}/${serviceName}/metrics?project=${projectId}`,
    logs_url: `https://console.cloud.google.com/run/detail/${region}/${serviceName}/logs?project=${projectId}`,
    node_version: process.version,
    environment: process.env.NODE_ENV || "development",
    uptime_seconds: Math.round(process.uptime()),
  });
}
