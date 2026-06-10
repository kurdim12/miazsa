// =============================================================================
// _shared/http.ts — Response/auth/rate-limit helpers for MIZAN Edge Functions
//
// Source of truth:
//   - docs/12 §1.6 envelope, §1.7 error model + codes, §1.8 rate limits
//   - docs/17 §2.1 JWT verify, §4.2 rate limiting, §4.3/§4.4 headers
//
// Provides:
//   - ok(data, {provenance, confidence, meta})  -> 200/2xx Envelope response
//   - fail(status, code, message, details?)      -> error-model response
//   - newRequestId()                             -> "req_..." correlation id
//   - getAuth(req)                               -> {userId, role} via JWT verify
//   - requireRole(role, allowed[])               -> boolean role gate
//   - rateLimit(...)                             -> pluggable per-user limiter
// =============================================================================

import { corsHeaders } from "_shared/cors.ts";
import { authedClient, serviceClient } from "_shared/supabase.ts";
import type {
  ApiError,
  AuthContext,
  ConfidenceObject,
  Envelope,
  EnvelopeMeta,
  ErrorCode,
  Provenance,
  UserRole,
} from "_shared/types.ts";

/** Pipeline/processing version surfaced in meta.processing_version. */
export const PROCESSING_VERSION = Deno.env.get("PROCESSING_VERSION") ?? "1.0.0";

/** HTTP status for each error code (docs/12 §1.7 table). */
const STATUS_FOR_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  UNAVAILABLE: 503,
  TIMEOUT: 504,
  INTERNAL: 500,
};

/**
 * Security response headers (docs/17 §4.4). A subset relevant to a JSON API
 * (the full CSP set is for HTML responses; we keep the safe, content-agnostic
 * ones here).
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/** Generate a sortable, URL-safe request id: "req_" + base36(time) + random. */
export function newRequestId(): string {
  const t = Date.now().toString(36);
  const r = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `req_${t}${r}`;
}

/** Merge CORS + security + JSON content-type headers for a given request. */
function baseHeaders(req: Request, extra?: Record<string, string>): Record<string, string> {
  return {
    ...corsHeaders(req),
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    ...(extra ?? {}),
  };
}

export interface OkOptions {
  provenance?: Provenance[];
  confidence?: ConfidenceObject | null;
  meta?: Partial<EnvelopeMeta>;
  status?: number; // default 200; use 202 for long jobs
}

/**
 * Build a standard envelope response (docs/12 §1.6). Always populates
 * meta.request_id / generated_at / processing_version / cached.
 */
export function ok<T>(req: Request, data: T, opts: OkOptions = {}): Response {
  const meta: EnvelopeMeta = {
    request_id: opts.meta?.request_id ?? newRequestId(),
    generated_at: new Date().toISOString(),
    processing_version: opts.meta?.processing_version ?? PROCESSING_VERSION,
    cached: opts.meta?.cached ?? false,
    ...opts.meta,
  };
  const envelope: Envelope<T> = { data, meta };
  if (opts.provenance) envelope.provenance = opts.provenance;
  if (opts.confidence) envelope.confidence = opts.confidence;

  return new Response(JSON.stringify(envelope), {
    status: opts.status ?? 200,
    headers: baseHeaders(req),
  });
}

/**
 * Build an error-model response (docs/12 §1.7). `Retry-After` is set
 * automatically for 429 (caller passes it via details.retry_after seconds).
 */
export function fail(
  req: Request,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string,
): Response {
  const rid = requestId ?? newRequestId();
  const body: ApiError = { error: { code, message, request_id: rid } };
  if (details) body.error.details = details;

  const extra: Record<string, string> = {};
  if (code === "RATE_LIMITED") {
    const retry = typeof details?.retry_after === "number" ? details.retry_after : 60;
    extra["Retry-After"] = String(retry);
  }

  return new Response(JSON.stringify(body), {
    status: STATUS_FOR_CODE[code],
    headers: baseHeaders(req, extra),
  });
}

/** Extract the raw bearer JWT from the Authorization header (or null). */
export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Verify the caller's JWT and resolve their MIZAN role.
 *
 * Per docs/17 §2.1 the authoritative role lives in `public.profiles.role`
 * (RLS reads it rather than trusting JWT claims, preventing claim forgery). We:
 *   1. verify the JWT via auth.getUser() on an anon client carrying the token,
 *   2. read profiles.role with the SERVICE client (bypasses RLS so we can read
 *      any caller's own role row reliably).
 *
 * Throws an AuthError (caught by the handler -> fail()) on any failure.
 */
export class AuthError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function getAuth(req: Request): Promise<AuthContext> {
  const token = bearerToken(req);
  if (!token) {
    throw new AuthError("UNAUTHENTICATED", "Missing Authorization bearer token.");
  }

  const anon = authedClient(token);
  const { data: userData, error: userErr } = await anon.auth.getUser();
  if (userErr || !userData?.user) {
    throw new AuthError("UNAUTHENTICATED", "Invalid or expired JWT.");
  }
  const userId = userData.user.id;

  // Resolve the authoritative role from public.profiles (service-role read).
  const svc = serviceClient();
  const { data: profile, error: profErr } = await svc
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profErr) {
    throw new AuthError("INTERNAL", `Failed to resolve role: ${profErr.message}`);
  }

  // Fall back to JWT app_metadata.mizan_role, else 'viewer' (docs/17 §2.2 default).
  const metaRole = (userData.user.app_metadata as Record<string, unknown> | undefined)
    ?.mizan_role as UserRole | undefined;
  const role = (profile?.role as UserRole | undefined) ?? metaRole ?? "viewer";

  return { userId, role };
}

/** Role gate (docs/12 per-function "Auth/role"). Returns true if permitted. */
export function requireRole(role: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(role);
}

// ---------------------------------------------------------------------------
// Rate limiting (docs/12 §1.8, docs/17 §4.2).
//
// PLUGGABLE BY DESIGN. The default backend is a per-instance in-memory sliding
// window (sufficient for a single-instance dev/demo, and a safe floor in prod).
// For production-grade limits across instances, set UPSTASH_REDIS_REST_URL +
// UPSTASH_REDIS_REST_TOKEN and the Upstash backend is used automatically
// (REST INCR + EXPIRE — the exact shape docs/17 §4.2 describes).
//
// Limits are keyed by user id and endpoint. Exceeding -> 429 + Retry-After.
// ---------------------------------------------------------------------------
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds until the window resets
}

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}
const memoryBuckets = new Map<string, Bucket>();

function memoryRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfter: windowSeconds };
  }
  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfter,
  };
}

async function upstashRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return memoryRateLimit(key, limit, windowSeconds);

  // INCR the counter; on first hit set the TTL. Pipeline both calls.
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["TTL", key],
    ]),
  });
  if (!res.ok) return memoryRateLimit(key, limit, windowSeconds); // fail-open to floor
  const out = (await res.json()) as Array<{ result: number }>;
  const count = out[0]?.result ?? 1;
  let ttl = out[1]?.result ?? -1;
  if (count === 1 || ttl < 0) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${windowSeconds}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    ttl = windowSeconds;
  }
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfter: Math.max(1, ttl),
  };
}

/**
 * Apply a rate limit for (userId, endpoint). Chooses Upstash when configured,
 * otherwise the in-memory floor. Window default 60s (docs/12 §1.8 "per min").
 */
export async function rateLimit(
  userId: string,
  endpoint: string,
  limit: number,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  const key = `rl:${endpoint}:${userId}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  if (Deno.env.get("UPSTASH_REDIS_REST_URL")) {
    return await upstashRateLimit(key, limit, windowSeconds);
  }
  return memoryRateLimit(key, limit, windowSeconds);
}

/**
 * Convenience guard: run getAuth + role check + rate limit, returning either an
 * error Response (to return immediately) or the resolved AuthContext.
 *
 * On success returns { auth }. On failure returns { response }.
 */
export async function guard(
  req: Request,
  opts: {
    allowed: UserRole[];
    endpoint: string;
    limit: number;
    windowSeconds?: number;
    requestId: string;
  },
): Promise<{ auth: AuthContext } | { response: Response }> {
  let auth: AuthContext;
  try {
    auth = await getAuth(req);
  } catch (e) {
    if (e instanceof AuthError) {
      return { response: fail(req, e.code, e.message, undefined, opts.requestId) };
    }
    // Unexpected (e.g. missing env / network) -> 500, not a misleading 401.
    return {
      response: fail(
        req,
        "INTERNAL",
        `Authentication failed: ${(e as Error).message}`,
        undefined,
        opts.requestId,
      ),
    };
  }

  if (!requireRole(auth.role, opts.allowed)) {
    return {
      response: fail(
        req,
        "FORBIDDEN",
        `Role '${auth.role}' is not permitted for this operation.`,
        { allowed: opts.allowed },
        opts.requestId,
      ),
    };
  }

  const rl = await rateLimit(auth.userId, opts.endpoint, opts.limit, opts.windowSeconds);
  if (!rl.allowed) {
    return {
      response: fail(
        req,
        "RATE_LIMITED",
        "Rate limit exceeded. Retry later.",
        { retry_after: rl.retryAfter, limit: opts.limit },
        opts.requestId,
      ),
    };
  }

  return { auth };
}

/**
 * Parse a JSON request body. Throws a plain Error on malformed JSON; callers
 * catch it and return a VALIDATION_ERROR (400) with the message.
 */
export async function parseJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}
