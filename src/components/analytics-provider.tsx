"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initAnalytics, syncRecording } from "@/lib/analytics";

/** Starts PostHog once on the client and pauses session recording on /admin pages. See src/lib/analytics.ts. */
export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (pathname) syncRecording(pathname);
  }, [pathname]);

  return null;
}
