// =============================================================================
// src/lib/supabase.ts — Browser Supabase client (PostgREST reads + Auth + Edge).
//
// Built from VITE_* env (docs/12 §1.1/§1.2). Only the anon (publishable) key is
// ever used in the browser — never the service role (see web/.env.example).
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True when the client is configured. The UI degrades gracefully when env is
 * missing (honest empty/error states rather than crashing) — important for a
 * fresh checkout where the EE compute / Supabase project may not be wired yet.
 */
export const isSupabaseConfigured: boolean = Boolean(url && anonKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    "[MIZAN] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — " +
      "reads and auth are disabled. Copy web/.env.example to web/.env.",
  );
}

/**
 * The shared browser client. When env is absent we still construct a client
 * against harmless placeholders so imports never throw; calls will simply fail
 * and surface as honest error states.
 */
export const supabase: SupabaseClient = createClient(
  url || "http://localhost:54321",
  anonKey || "public-anon-key-not-set",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

/** Base URL for Edge Functions (docs/12 §1.1). */
export const functionsBaseUrl: string = url ? `${url.replace(/\/$/, "")}/functions/v1` : "";
