import posthog from "posthog-js";

/**
 * PostHog product analytics for takemeout.mbsoft.com. Same project as mbsoft.github.io (events are told apart by
 * $host). The key is PostHog's public project key, safe in client code; override with NEXT_PUBLIC_POSTHOG_KEY.
 *
 * Privacy:
 * - Cookieless (persistence "memory"): no cookies or localStorage, no banner, no cross-visit tracking.
 * - No identify(): users stay anonymous, and we never send emails, names or ids as person properties.
 * - URLs are scrubbed before sending: query strings dropped (e.g. /verify-email?email=…, reset tokens) and share
 *   tokens replaced with :token.
 * - Session replays mask every input and all text; autocapture masks element text and attributes.
 * - Nothing is sent from /admin.
 * - Runs only on the live host and honours Do Not Track. Add ?posthog=debug to a URL to run it anywhere, with logging.
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "phc_qpUrD9JPQ6RPmLqi8YyV3Ueo5SDBr4nEtUUiRNadoTi2";
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const LIVE = /(^|\.)takemeout\.mbsoft\.com$/;

let started = false;

/** Drop query strings and fragments, and hide share tokens. */
export function scrubUrl(value: unknown): unknown {
  if (typeof value !== "string" || !value) return value;
  return value.replace(/[?#].*$/, "").replace(/\/share\/[^/]+/, "/share/:token");
}

const URL_PROPS = ["$current_url", "$pathname", "$referrer", "$initial_current_url", "$initial_referrer", "$prev_pageview_pathname"];

function isAdmin(): boolean {
  return typeof location !== "undefined" && location.pathname.startsWith("/admin");
}

export function initAnalytics(): void {
  if (started || typeof window === "undefined") return;
  const debug = /[?&]posthog=debug\b/.test(location.search);
  if (!KEY) return;
  if (!debug && !LIVE.test(location.hostname)) return;
  if (!debug && (navigator.doNotTrack === "1" || (window as unknown as { doNotTrack?: string }).doNotTrack === "1")) return;
  started = true;

  posthog.init(KEY, {
    api_host: HOST,
    persistence: "memory",
    person_profiles: "identified_only",
    autocapture: true,
    capture_pageview: "history_change",
    capture_pageleave: true,
    respect_dnt: !debug,
    disable_surveys: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    debug,
    before_send: (event) => {
      if (!event || isAdmin()) return null;
      const props = event.properties || {};
      for (const key of URL_PROPS) if (key in props) props[key] = scrubUrl(props[key]);
      if (event.$set) for (const key of URL_PROPS) if (key in event.$set) event.$set[key] = scrubUrl(event.$set[key]);
      return event;
    },
  });
}

/** Pause or resume session recording when entering or leaving /admin. */
export function syncRecording(pathname: string): void {
  if (!started) return;
  if (pathname.startsWith("/admin")) posthog.stopSessionRecording();
  else if (!posthog.sessionRecordingStarted()) posthog.startSessionRecording();
}

/** A named product event. A no-op when analytics isn't running. Never pass personal data in props. */
export function track(event: string, props?: Record<string, string | number | boolean | null | undefined>): void {
  if (!started) return;
  posthog.capture(event, props);
}
