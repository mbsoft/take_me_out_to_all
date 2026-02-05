import { db } from "./db";

interface ApiLogEntry {
  api_name: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  user_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget API call logging to api_usage_log table.
 * Errors are caught silently to avoid blocking the main request.
 */
export function logApiCall(entry: ApiLogEntry) {
  Promise.resolve(
    db.from("api_usage_log").insert({
      api_name: entry.api_name,
      endpoint: entry.endpoint,
      method: entry.method,
      status_code: entry.status_code,
      response_time_ms: entry.response_time_ms,
      user_id: entry.user_id || null,
      metadata: entry.metadata || null,
    }),
  ).catch((err) => {
    console.error("[api-logger] Failed to log API call:", err);
  });
}

/**
 * Wrapper around fetch that automatically logs the call.
 */
export async function trackedFetch(
  url: string | URL,
  options: RequestInit & { apiName: string; userId?: string },
): Promise<Response> {
  const start = Date.now();
  const response = await fetch(url.toString(), options);
  const elapsed = Date.now() - start;

  logApiCall({
    api_name: options.apiName,
    endpoint: new URL(url.toString()).pathname,
    method: options.method || "GET",
    status_code: response.status,
    response_time_ms: elapsed,
    user_id: options.userId,
  });

  return response;
}
