# MIZAN Edge Functions (Phase-2 vertical slice)

Deno / TypeScript Supabase Edge Functions that orchestrate the MIZAN backend:
compute EO indicators, score groundwater stress, and compute the Validation-
Envelope confidence — each wrapped in the standard response envelope with
**provenance + confidence** on every value (docs/12 §1.6) and the uniform error
model (docs/12 §1.7). MIZAN never fabricates: absence of grounded data yields
`422 UNPROCESSABLE` (or `data:null` + `meta.note`).

## Layout

```
supabase/functions/
├── deno.json              # import map (pins supabase-js, zod, std) + compiler opts
├── _shared/
│   ├── cors.ts            # CORS headers + OPTIONS preflight (docs/17 §4.3)
│   ├── types.ts           # Envelope / Provenance / Confidence / ApiError + req/res types
│   ├── supabase.ts        # service-role + authed (JWT) clients from env
│   ├── http.ts            # ok() / fail() / newRequestId() / getAuth() / requireRole() / rateLimit() / guard()
│   ├── confidence.ts      # six factor scorers + weighted geometric mean (docs/09)
│   └── risk.ts            # five sub-index normalizers + weighted aggregation + classify (docs/08)
├── ee-compute/index.ts    # POST — on-demand EO compute via EE Worker (docs/12 §3.1)
├── risk-score/index.ts    # POST — gw_stress_index + class from stored inputs (docs/12 §3.2)
└── confidence/index.ts    # POST — confidence envelope for a metric (docs/12 §3.6)
```

`_shared/confidence.ts` and `_shared/risk.ts` are **pure** (no I/O) and are the
unit-testable core of the scoring math.

## Endpoints (summary)

| Function | Method/Path | Role | Rate limit | Notes |
|----------|-------------|------|-----------|-------|
| `ee-compute` | `POST /functions/v1/ee-compute` | analyst, admin | 10/min | AOI (≤5000 km²) or region; idempotent by (aoi/region, indicators, period, version); 202 for long jobs; 502 on GEE/worker failure; 422 if no imagery. |
| `risk-score` | `POST /functions/v1/risk-score` | analyst, admin | 30/min | Reads stored indicator inputs; 5 normalized sub-indices → weighted sum → index + class; 422 if no components. |
| `confidence` | `POST /functions/v1/confidence` | analyst, admin | 60/min | Accepts `{metric_kind, metric_id}` (docs §3.6) or `{region_id, indicator, date}`; 404 if metric absent, 422 if no factor inputs. |

All three require the gateway `apikey` header **and** `Authorization: Bearer <JWT>`.

## Running locally

Prereqs: [Supabase CLI](https://supabase.com/docs/guides/local-development),
Docker, and a local stack with the migrations applied.

```bash
# from repo root — start the local stack (Postgres + Auth + PostgREST + Storage)
supabase start
supabase db reset            # applies supabase/migrations/* and seeds catalogs

# serve all functions (reads supabase/functions/deno.json import map)
supabase functions serve --no-verify-jwt --env-file supabase/functions/.env.local
```

> `--no-verify-jwt` lets the gateway pass requests through; the functions still
> call `auth.getUser()` themselves, so use a real user JWT to exercise role checks.
> Omit the flag to have the gateway enforce JWT presence too.

### Type-check / lint / format

```bash
deno check supabase/functions/**/*.ts        # type correctness (docs/17 §7.3)
deno lint   supabase/functions
deno fmt    supabase/functions
```

## Required secrets / env

Auto-injected in deployed functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. For local serving put them (plus the below) in
`supabase/functions/.env.local` (never commit real values — see root `.env.example`).

| Variable | Used by | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | all | Project URL (auto in prod). |
| `SUPABASE_ANON_KEY` | all | Anon key for JWT verification client (auto in prod). |
| `SUPABASE_SERVICE_ROLE_KEY` | all | Service-role writes/reads bypassing RLS (auto in prod). **Secret.** |
| `EE_WORKER_URL` | ee-compute | EE Worker base URL; we call `POST {URL}/compute`. |
| `EE_WORKER_AUTH_TOKEN` | ee-compute | Bearer token for the worker. **Secret.** |
| `PROCESSING_VERSION` | all | Optional; pipeline version stamped into provenance + meta (default `1.0.0`). |
| `ALLOWED_ORIGINS` | all (CORS) | Comma-separated allowlist; unset → `*` dev fallback. Set in prod. |
| `EE_WORKER_TIMEOUT_MS` | ee-compute | Optional sync budget before mapping to 504 (default 55000). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | all (rate limit) | Optional; enables cross-instance rate limiting. Without them an in-memory per-instance limiter is used (pluggable — see `_shared/http.ts`). |

Set production secrets with:

```bash
supabase secrets set EE_WORKER_URL=... EE_WORKER_AUTH_TOKEN=... ALLOWED_ORIGINS=https://mizan.app
```

## Deploy

```bash
supabase functions deploy ee-compute risk-score confidence
```

## Design notes / judgement calls

- **Rate limiting is pluggable.** Default is an in-memory sliding-window floor
  (single-instance safe). Configure Upstash REST env vars for production-grade,
  cross-instance limits (the `INCR`+`EXPIRE` shape docs/17 §4.2 describes). Keyed
  by user id + endpoint.
- **Role source of truth.** `getAuth()` verifies the JWT, then reads
  `public.profiles.role` with the service client (docs/17 §2.1 — RLS-safe, not
  trusting JWT claims), falling back to `app_metadata.mizan_role`, then `viewer`.
- **`confidence` request shape.** docs/12 §3.6 specifies `{metric_kind, metric_id}`;
  the build brief asked for `{region_id, indicator, date}`. Both are accepted —
  the descriptor form resolves the latest `indicator_value` at/just-before `date`.
- **Confidence factor inputs** are read from stored metadata
  (`provenance.parameters`, `datasets`, `observations`, `model_runs`); when an
  input is absent the factor is dropped and weights renormalize (docs/09 §4.2).
  When *no* factor is derivable, confidence is reported **unavailable** (422),
  never fabricated.
- **Risk normalization references** (`Q_safe/Q_max`, `E_ref`, SPI z-floors, …)
  are transparent, configurable hyperparameters recorded in
  `provenance.parameters` for reproducibility (docs/08 §3.3); they are model
  configuration, not invented data.
- **Ad-hoc AOI persistence.** ee-compute upserts an `aoi`-kind region keyed by a
  deterministic code derived from the AOI hash. Geometry is written as a GeoJSON
  `MultiPolygon` (PostgREST casts GeoJSON → PostGIS geometry on write); if your
  PostgREST build rejects that cast, add an `insert_aoi_region(geojson)` RPC.
- **Idempotency.** ee-compute hashes (aoi/region, indicators, period, version,
  options) into an `idempotency_key` stored in `provenance.parameters`; a prior
  matching computation is returned as `cached:true` instead of re-running EE.
```
