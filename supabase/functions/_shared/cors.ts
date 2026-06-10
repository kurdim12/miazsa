// =============================================================================
// _shared/cors.ts — CORS headers + OPTIONS preflight helper
// MIZAN Phase-2 Edge Functions (Deno / TypeScript)
//
// Mirrors the security posture in docs/17-security.md §4.3: allow only the
// configured frontend origins, the small header set the SPA + Edge contract
// uses, and the GET/POST/OPTIONS verbs the functions expose.
//
// Origin allow-listing is driven by the ALLOWED_ORIGINS env var (comma-
// separated). When unset we fall back to "*" so local `supabase functions
// serve` and curl work out of the box; production MUST set ALLOWED_ORIGINS.
// =============================================================================

/** Headers the browser is permitted to send to an Edge Function. */
const ALLOW_HEADERS = "authorization, apikey, content-type, x-client-info, x-request-id";

/** Verbs the Edge Functions expose (all are POST except `tiles`, which is GET). */
const ALLOW_METHODS = "GET, POST, OPTIONS";

/**
 * Parse the comma-separated ALLOWED_ORIGINS env var into a clean list.
 * Empty / unset → empty list (meaning: wildcard fallback, see resolveOrigin).
 */
function allowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/**
 * Decide the Access-Control-Allow-Origin value to echo back.
 * - If ALLOWED_ORIGINS is configured and the request Origin matches → echo it.
 * - If ALLOWED_ORIGINS is configured but no match → "" (browser blocks).
 * - If ALLOWED_ORIGINS is NOT configured → "*" (permissive dev fallback).
 */
function resolveOrigin(requestOrigin: string | null): string {
  const allow = allowedOrigins();
  if (allow.length === 0) return "*"; // dev fallback
  if (requestOrigin && allow.includes(requestOrigin)) return requestOrigin;
  return "";
}

/** Build the CORS headers for a given request. */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = resolveOrigin(req.headers.get("origin"));
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

/**
 * Handle a CORS preflight. Returns a 204 Response when the request is an
 * OPTIONS preflight, otherwise `null` (caller proceeds with normal handling).
 *
 * Usage:
 *   const pre = handlePreflight(req);
 *   if (pre) return pre;
 */
export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}
