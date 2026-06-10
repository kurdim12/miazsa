# MIZAN — Earth Observation Environmental Intelligence for Jordan

> **MIZAN** (Arabic **ميزان**, "balance / scale") transforms Earth Observation data into
> environmental intelligence for Jordan, with a primary focus on **groundwater stress
> monitoring** in the **Azraq Basin** and extensible national coverage.

| | |
|---|---|
| **Status** | Phase 2 — Vertical slice (implementation in progress) |
| **Primary use case** | Groundwater stress monitoring |
| **Demo area** | Azraq Basin |
| **Secondary scope** | National Jordan coverage |
| **Last updated** | 2026-06-10 |

---

## What MIZAN is

MIZAN converts satellite and climate data into traceable, explainable environmental
indicators for decision-makers (e.g. Ministry of Water & Irrigation, RSCN, researchers,
and donors). It covers groundwater-stress monitoring, irrigation monitoring, agricultural
expansion detection, rainfall-anomaly detection, and environmental risk assessment.

## What MIZAN does **not** claim

MIZAN does **not** directly observe groundwater, wells, water tables, or aquifer pressure,
and it makes **no legal determination**. It **estimates groundwater-stress indicators** from
Earth Observation proxies (irrigated-area expansion & crop water demand, rainfall/SPI
anomalies, vegetation–water divergence, surface-water decline, and coarse GRACE storage
context) combined through a transparent, documented water-balance and risk model.

## Non-negotiable scientific-integrity rules

- Never invent or fabricate environmental, satellite, rainfall, or groundwater data.
- Every number displayed originates from **Google Earth Engine**, **stored datasets**, or **model outputs**.
- All outputs are **traceable** via a provenance record.
- Every metric exposes the **Validation Envelope**: **Source · Date · Methodology · Confidence · Explanation**.

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite, Tailwind + shadcn/ui (Lovable-compatible), MapLibre GL JS + MapTiler, Recharts, deck.gl, i18n EN/AR.
- **Backend:** Supabase — PostgreSQL 15 + PostGIS, Auth (JWT + RLS), Storage, Edge Functions (Deno/TypeScript).
- **Geospatial compute:** Google Earth Engine (Python) in a Cloud Run "EE Worker".
- **AI:** OpenAI, accessed only through a grounded server-side Edge Function proxy.

---

## Documentation

The complete specification lives in [`/docs`](./docs):

| # | Document | Scope |
|---|----------|-------|
| 01 | [Project Overview](./docs/01-project-overview.md) | Vision, mission, personas, capabilities |
| 02 | [Problem Definition](./docs/02-problem-definition.md) | Problem, stakeholders, requirements, use cases |
| 03 | [System Architecture](./docs/03-system-architecture.md) | Components, data flow, decisions |
| 04 | [Data Sources](./docs/04-data-sources.md) | Satellite & climate datasets, licensing |
| 05 | [Earth Engine Pipelines](./docs/05-earth-engine-pipelines.md) | EE Worker, pipeline catalog |
| 06 | [Remote Sensing Methods](./docs/06-remote-sensing-methods.md) | Indices, masking, ET₀, SPI methodology |
| 07 | [Machine Learning](./docs/07-machine-learning.md) | RF, XGBoost, Isolation Forest, SHAP, MLOps |
| 08 | [Risk Scoring](./docs/08-risk-scoring.md) | Groundwater stress index & weighting |
| 09 | [Confidence Engine](./docs/09-confidence-engine.md) | Per-metric confidence & validation envelope |
| 10 | [Digital Twin](./docs/10-digital-twin.md) | Scenario engine for the Azraq Basin |
| 11 | [Database Schema](./docs/11-database-schema.md) | PostgreSQL + PostGIS schema & provenance |
| 12 | [API Specification](./docs/12-api-specification.md) | PostgREST + Edge Functions |
| 13 | [UI Pages](./docs/13-ui-pages.md) | Design system & all 10 pages |
| 14 | [Judge Mode](./docs/14-judge-mode.md) | Guided evaluation experience |
| 15 | [Report Generator](./docs/15-report-generator.md) | Traceable PDF/HTML reports |
| 16 | [Validation Framework](./docs/16-validation-framework.md) | Data/method/model/product validation |
| 17 | [Security](./docs/17-security.md) | Threat model, RLS, secrets, AI guardrails |
| 18 | [Deployment](./docs/18-deployment.md) | Environments, Docker, CI/CD, production readiness |
| 19 | [AstroCode Compliance](./docs/19-astrocode-compliance.md) | Deliverables traceability |
| 20 | [Limitations](./docs/20-limitations.md) | Scientific, data, and model limitations |

## AstroCode deliverables

Every feature maps to at least one deliverable: **Functional Prototype · Data Explanation ·
AI/Analytics Method · Results Visualization · Jordanian Use Case · Impact Statement**.
See [`docs/19-astrocode-compliance.md`](./docs/19-astrocode-compliance.md) for the full traceability matrix.

## Project phases

1. **Phase 1 — Specification** ✅ *(complete)*: the 20 documents above.
2. **Phase 2 — Implementation** 🔨 *(in progress — vertical slice landed)*: an end-to-end slice proving the architecture (DB → EE Worker → Edge Functions → React for the Azraq Basin); full build to follow.
3. **Phase 3 — Production readiness** ⏳: caching, logging, monitoring, error handling, rate limiting, security headers, secrets management, performance.

---

## Repository layout

```
miazsa/
├── docs/                      # Phase 1 — the 20 specification documents
├── supabase/
│   ├── migrations/            # PostGIS schema, RLS, catalog seeds, illustrative demo seed
│   ├── functions/             # Edge Functions: ee-compute, risk-score, confidence (+ _shared)
│   └── config.toml            # Supabase local config
├── ee-worker/                 # FastAPI + Google Earth Engine compute worker (Cloud Run)
│   └── app/                   # main.py, pipelines/ (S2 indices, surface water, CHIRPS/SPI)
├── web/                       # React 18 + TS + Vite frontend (National, Map, Azraq, Login)
├── .env.example               # master environment template (copy per subsystem)
└── README.md
```

## Vertical slice — what it proves

The slice demonstrates the full traceable data path for the **Azraq Basin**:

**EE Worker** (real Sentinel-2 / CHIRPS compute) → **Supabase** (`indicator_values` + `provenance` + `confidence_scores` + `risk_scores`) → **Edge Functions** (`risk-score`, `confidence`, `ee-compute`) → **React** (Azraq Intelligence + Jordan Map, with the 5-field **Validation Envelope** on every metric, honest empty states, and a synthetic-data banner).

> **Data integrity:** real numbers come only from the EE Worker (live GEE compute). For a local demo without GEE credentials, an **optional, clearly-labelled illustrative seed** (`0011_seed_demo_ILLUSTRATIVE.sql`) populates Azraq with synthetic values — every such value carries `provenance.source = "ILLUSTRATIVE DEMO (synthetic)…"`, forced **Low** confidence, and triggers a prominent in-app banner. It is never presented as a real observation.

## Running the vertical slice

Prereqs: Node 20+, the [Supabase CLI](https://supabase.com/docs/guides/local-development), Docker (for Supabase local), and Python 3.11 (for the EE Worker). Copy `.env.example` values into `web/.env` and `ee-worker/.env`, and set Edge Function secrets.

```bash
# 1) Database (Supabase local): apply schema + catalogs + (optional) demo seed
supabase start
supabase db reset                 # runs migrations 0001–0011 (incl. illustrative demo seed)

# 2) Edge Functions (Deno) — served by the Supabase CLI
supabase functions serve          # ee-compute, risk-score, confidence

# 3) EE Worker (requires real GEE service-account creds for live data)
cd ee-worker && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080

# 4) Frontend
cd web && npm install && npm run dev    # http://localhost:5173
```

With the demo seed applied, the **Azraq Intelligence** page (`/azraq`) renders the groundwater-stress index, the five weighted sub-indices, and key indicators — each with its Validation Envelope — behind the illustrative-data banner. To populate **real** data, run an `ee-compute` request (or a direct EE Worker `/compute`) for `region_id = azraq_basin` with valid GEE credentials.

See [`docs/18-deployment.md`](./docs/18-deployment.md) for the full deployment, Docker, and CI/CD design.
