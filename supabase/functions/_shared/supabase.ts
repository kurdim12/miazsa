// =============================================================================
// _shared/supabase.ts — Supabase clients from env (server-side)
//
// Two clients, two purposes (docs/17-security.md §2.4 "least privilege"):
//   - serviceClient(): SERVICE_ROLE key, bypasses RLS. Used for the write path
//     (provenance, indicator_values, risk_scores, confidence_scores, audit_log)
//     and for reads that must see everything regardless of the caller's RLS.
//   - authedClient(jwt): ANON key + the caller's JWT in the Authorization
//     header. Used ONLY to verify the caller (auth.getUser) and to perform
//     reads under the caller's RLS where appropriate.
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are auto-injected
// in deployed Edge Functions (see .env.example). We read them via Deno.env and
// fail loudly (never silently fabricate a client) if a required one is missing.
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Read a required env var or throw a descriptive error (server-side only). */
function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

/**
 * Service-role client. Bypasses RLS — never expose this key or this client's
 * results without the function's own role checks (docs/17 §2.1).
 * Auth persistence is disabled: Edge Functions are stateless (docs/03 P5).
 */
export function serviceClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Anon client carrying the caller's JWT. Used to identify the caller via
 * `auth.getUser()` and for RLS-scoped reads. The JWT is the raw bearer token
 * (without the "Bearer " prefix).
 */
export function authedClient(jwt: string): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

export type { SupabaseClient };
