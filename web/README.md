# MIZAN — Web (Phase-2 vertical slice)

Frontend for **MIZAN — Earth Observation Environmental Intelligence for Jordan**.
React 18 + TypeScript + Vite, Tailwind CSS, TanStack Query, React Router v6,
`@supabase/supabase-js`, MapLibre GL + MapTiler, and Recharts.

This slice renders three pages for the **Azraq Basin** vertical slice:

- `/` — **National Command Center**: headline groundwater-stress + key indicators.
- `/map` — **Jordan Monitoring Map**: MapLibre map + per-region inspection panel.
- `/azraq` — **Azraq Basin Intelligence**: stress gauge, 5 sub-index breakdown,
  key indicator cards, precip/NDVI trends, and a "Run analysis" affordance.
- `/login` — Supabase email/password sign-in/up (public data is readable without it).

## Scientific integrity (built into the UI)

- **Validation Envelope** on every metric — Source, Date, Methodology,
  Confidence, Explanation (docs/09 §1; docs/13 §B.1). Click any confidence badge
  or info icon to open it.
- **Scientific stance note** is persistent: MIZAN *estimates* indicators from EO
  proxies; it does **not** observe groundwater directly and makes **no** legal
  determination (docs/08 §0).
- **Honest empty states**: if there is no grounded data, the UI says
  *"No grounded data yet for this region/period — run an EE compute"* and never
  renders placeholder numbers.
- **Synthetic-data banner**: if any displayed metric's `provenance.source` starts
  with `ILLUSTRATIVE DEMO`, a global banner appears and those metrics are marked
  *"Illustrative demo data — not real EO observations."*

## Prerequisites

- Node.js 18+ and npm.
- A Supabase project with the MIZAN schema applied (`supabase/migrations`) and
  catalogs seeded (`0009_seed_catalogs.sql`).
- A MapTiler Cloud key (optional — without it the map falls back to OSM raster
  tiles so it still renders).

## Environment

Copy the example file and fill in values (only `VITE_*` vars reach the browser —
**never** put the service-role key here):

```bash
cp web/.env.example web/.env
```

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (PostgREST reads + Edge Functions + Auth) |
| `VITE_SUPABASE_ANON_KEY` | Anon (publishable) key — not the service role |
| `VITE_MAPTILER_KEY` | MapTiler style/tiles key (optional; OSM fallback otherwise) |
| `VITE_TILE_BASE_URL` | Optional base URL for pre-exported EO tiles |
| `VITE_APP_ENV` | Shown in the nav/footer build banner |
| `VITE_APP_VERSION` | Shown in the nav/footer build banner |

The app degrades gracefully when Supabase env is missing: it renders the
"Backend not configured" empty state rather than crashing.

## Install & run

```bash
cd web
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

## Scripts

| Script | Action |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | `tsc -b && vite build` (type-checks then builds) |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (TypeScript + React hooks) |

## Data dependencies

**Real values require the EE compute to have run.** Reads come from PostgREST
over the canonical tables (`indicator_values`, `risk_scores`, `regions`,
`alerts`), each embedding `provenance` (+ dataset attribution). Until the Earth
Engine pipeline + `risk-score` Edge Function have populated rows for a region and
period, the pages show honest empty states.

If your database is seeded with the local **demo seed** (provenance source
prefixed `ILLUSTRATIVE DEMO`), the app shows the global **SyntheticDataBanner**
and marks each affected metric — these are never presented as real EO data.

## How it maps to the specs

- `src/lib/types.ts` mirrors the API wire contract (envelope, provenance,
  confidence) from `docs/12` §1.6 and the DB shapes in `docs/11`.
- `src/lib/api.ts` implements PostgREST reads (`docs/12` §2) with provenance
  embeds, and the `risk-score` / `confidence` Edge Function calls (`docs/12`
  §3.2 / §3.6) returning the standard envelope.
- Confidence levels (High ≥ 0.80 / Medium 0.50–0.79 / Low < 0.50) follow
  `docs/09` §4.3; stress classes (Low/Moderate/High/Severe over 0–100) and the
  five weighted sub-indices follow `docs/08`.
