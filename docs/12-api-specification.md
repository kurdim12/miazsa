# 12 — API Specification

| | |
|---|---|
| **Document** | 12 — API Specification |
| **Project** | MIZAN — Earth Observation Environmental Intelligence for Jordan |
| **Version** | 0.1 (Draft) |
| **Status** | Phase 1 — Specification |
| **Last updated** | 2026-06-10 |
| **Related** | [03-system-architecture](./03-system-architecture.md) · [04-data-sources](./04-data-sources.md) · [05-earth-engine-pipelines](./05-earth-engine-pipelines.md) · [07-machine-learning](./07-machine-learning.md) · [08-risk-scoring](./08-risk-scoring.md) · [09-confidence-engine](./09-confidence-engine.md) · [10-digital-twin](./10-digital-twin.md) · [11-database-schema](./11-database-schema.md) · [13-ui-pages](./13-ui-pages.md) · [14-judge-mode](./14-judge-mode.md) · [15-report-generator](./15-report-generator.md) · [16-validation-framework](./16-validation-framework.md) · [17-security](./17-security.md) · [18-deployment](./18-deployment.md) |

**Purpose.** This document specifies MIZAN's API surface: the PostgREST auto-generated read endpoints over the canonical tables and the eight Supabase Edge Functions that orchestrate compute, scoring, AI, scenarios, reports, confidence, alerts, and tiles. It defines conventions (auth, versioning, pagination, filtering, the standard response envelope, error model, rate limits), gives concrete request/response examples and OpenAPI-style snippets for every endpoint, documents scheduled triggers/webhooks, and maps endpoints to the consuming UI pages. It binds to the schema in [11-database-schema](./11-database-schema.md).

**Contract invariant.** *Every endpoint that returns values returns provenance + confidence.* Read endpoints embed the linked `provenance` and `confidence_scores`; Edge Functions wrap results in the standard envelope `{ data, provenance, confidence, meta }`. This enforces the mission rule that **every number is traceable and honestly bounded**, and that **MIZAN never fabricates data**.

**Deliverables mapping.** Supports **Functional Prototype** (the operational API), **Data Explanation** (provenance in responses), **AI/Analytics Method** (ee-compute, risk-score, ai-insights, scenario-run), **Results Visualization** (tiles), and **Impact Statement** (auditable outputs).

---

## 1. Conventions

### 1.1 Base URLs
| Surface | Base URL | Notes |
|---------|----------|-------|
| PostgREST (read) | `https://<project-ref>.supabase.co/rest/v1/` | Auto REST over RLS-protected tables. |
| Edge Functions | `https://<project-ref>.supabase.co/functions/v1/` | Deno/TS orchestrators. |
| Auth | `https://<project-ref>.supabase.co/auth/v1/` | Supabase GoTrue (sign-in, token). |
| Storage | `https://<project-ref>.supabase.co/storage/v1/` | Signed URLs for COGs, reports, exports. |

### 1.2 Authentication
- **JWT bearer** issued by Supabase Auth. Every request sends:
  - `apikey: <SUPABASE_ANON_KEY>` (publishable) — required by the gateway.
  - `Authorization: Bearer <JWT>` — the user session token; carries the `role` claim ∈ {viewer, analyst, admin, judge}.
- **RLS** enforces row visibility from the JWT; **Edge Functions** additionally enforce role checks before side effects (see [17-security](./17-security.md)).
- Service-role key, GEE service account, and OpenAI key are **server-side only** and never accepted from clients.

### 1.3 Versioning
- Path-versioned: `/rest/v1`, `/functions/v1`. Breaking changes introduce `/v2`. Output semantics also carry a `processing_version` inside provenance ([11](./11-database-schema.md)).

### 1.4 Pagination
- **PostgREST:** `Range`/`Range-Unit: items` headers or `?limit=&offset=`; total via `Prefer: count=exact` → `Content-Range` response header.
- **Edge Functions** returning lists: `meta.page`, `meta.page_size`, `meta.total` in the envelope; request via `?page=&page_size=` (default 50, max 500).

### 1.5 Filtering / shaping (PostgREST)
- Operators: `eq, neq, gt, gte, lt, lte, in, like, ilike, is`. Example: `?obs_date=gte.2025-01-01&value=gt.0.3`.
- Ordering: `?order=obs_date.desc`.
- Column selection + embeds: `?select=obs_date,value,provenance(*),confidence_scores(*)`.

### 1.6 Standard response envelope (Edge Functions)
Every value-returning Edge Function responds with:
```json
{
  "data": { },
  "provenance": [
    {
      "id": "uuid",
      "source": "Earth Engine",
      "dataset_id": "uuid",
      "ee_asset_id": "COPERNICUS/S2_SR_HARMONIZED",
      "period_start": "2026-05-01",
      "period_end": "2026-05-31",
      "processing_method": "S2 median composite + NDVI",
      "processing_version": "1.3.0",
      "parameters": { "cloud_prob_threshold": 50 },
      "model_run_id": null,
      "attribution": "Contains modified Copernicus Sentinel data 2026"
    }
  ],
  "confidence": {
    "score": 0.83,
    "level": "High",
    "factors": {
      "freshness": {"value": 0.95, "weight": 0.20},
      "source_quality": {"value": 0.90, "weight": 0.20},
      "spatial_coverage": {"value": 0.88, "weight": 0.20},
      "temporal_completeness": {"value": 0.80, "weight": 0.15},
      "model_validation": {"value": 0.75, "weight": 0.15},
      "convergence": {"value": 0.70, "weight": 0.10}
    }
  },
  "meta": {
    "request_id": "req_01J...",
    "generated_at": "2026-06-10T12:00:00Z",
    "processing_version": "1.3.0",
    "cached": false
  }
}
```
- `data` shape is endpoint-specific. `provenance` is an array (a result may combine multiple sources). `confidence` is the aggregate for `data` (per-item confidence appears inside list items when relevant). For PostgREST reads, the equivalent envelope is achieved via **embeds** (provenance + confidence_scores joined in `select`).

### 1.7 Error model
Uniform error body (both PostgREST-wrapped and Edge):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "AOI exceeds maximum allowed area (5000 km2).",
    "details": { "max_km2": 5000, "got_km2": 8123 },
    "request_id": "req_01J..."
  }
}
```

| HTTP | code | Meaning |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Malformed/invalid request (bad AOI, missing field, out-of-range param). |
| 401 | `UNAUTHENTICATED` | Missing/invalid JWT. |
| 403 | `FORBIDDEN` | Authenticated but role/RLS denies. |
| 404 | `NOT_FOUND` | Resource/region/indicator absent. |
| 409 | `CONFLICT` | Idempotency conflict / duplicate job. |
| 422 | `UNPROCESSABLE` | Valid shape but semantically impossible (e.g., no data for period). |
| 429 | `RATE_LIMITED` | Rate limit exceeded (see §1.8); `Retry-After` header set. |
| 502 | `UPSTREAM_ERROR` | GEE / OpenAI upstream failure. |
| 503 | `UNAVAILABLE` | Dependency unavailable; degraded mode. |
| 504 | `TIMEOUT` | Compute exceeded budget (long jobs return 202 instead). |
| 500 | `INTERNAL` | Unhandled error (logged with request_id). |

Honest-data rule: when no grounded data exists for a request, endpoints return `422 UNPROCESSABLE` (or `data: null` with an explanatory `meta.note`) — they **never** fabricate a value.

### 1.8 Rate limits (defaults; tunable per [17-security](./17-security.md))
| Surface | Limit (per user) | Notes |
|---------|------------------|-------|
| PostgREST reads | 120 req/min | Cached client-side via TanStack Query. |
| ee-compute | 10 req/min, 100/day | Heavy; idempotency dedupes bursts. |
| risk-score | 30 req/min | Mostly reads stored components. |
| ai-insights | 20 req/min, 300/day | OpenAI cost guard. |
| scenario-run | 20 req/min | |
| report-generate | 5 req/min, 50/day | PDF rendering cost. |
| confidence | 60 req/min | |
| alerts | 30 req/min | |
| tiles | 120 req/min | Token/URL brokering. |

Exceeding a limit → `429` + `Retry-After`. Limits keyed by user id (and IP for anon).

---

## 2. PostgREST read endpoints (canonical tables)

All return JSON arrays; all are RLS-filtered; all support filtering/ordering/pagination/embeds (§1.5). Value tables embed `provenance` and `confidence_scores` to satisfy the contract invariant.

### 2.1 `GET /rest/v1/regions`
List/spatial catalog of analysis units.
```
GET /rest/v1/regions?kind=eq.basin&select=id,code,name_en,name_ar,kind,area_km2
```
```json
[{ "id":"…","code":"azraq_basin","name_en":"Azraq Basin","name_ar":"حوض الأزرق","kind":"basin","area_km2":12345.6 }]
```

### 2.2 `GET /rest/v1/indicators` and `GET /rest/v1/datasets`
Catalogs (units, attribution). Public read.
```
GET /rest/v1/datasets?select=key,name,ee_asset_id,attribution,license,temporal_res
```

### 2.3 `GET /rest/v1/indicator_values` (with provenance + confidence)
The core time-series read; **always** embed provenance + confidence.
```
GET /rest/v1/indicator_values
  ?region_id=eq.<region_uuid>
  &indicator_id=eq.<indicator_uuid>
  &obs_date=gte.2025-06-01
  &order=obs_date.desc
  &select=obs_date,value,confidence,
          provenance(source,ee_asset_id,processing_method,processing_version,period_start,period_end,parameters,datasets(attribution)),
          confidence_scores(score,level,factors)
```
Response (one element):
```json
{
  "obs_date": "2026-05-31",
  "value": 0.42,
  "confidence": 0.83,
  "provenance": {
    "source": "Earth Engine",
    "ee_asset_id": "COPERNICUS/S2_SR_HARMONIZED",
    "processing_method": "S2 median composite + NDVI",
    "processing_version": "1.3.0",
    "period_start": "2026-05-01",
    "period_end": "2026-05-31",
    "parameters": {"cloud_prob_threshold": 50},
    "datasets": {"attribution": "Contains modified Copernicus Sentinel data 2026"}
  },
  "confidence_scores": {
    "score": 0.83, "level": "High",
    "factors": { "freshness": {"value":0.95,"weight":0.20}, "...": {} }
  }
}
```

### 2.4 `GET /rest/v1/risk_scores` (with components + provenance + confidence)
```
GET /rest/v1/risk_scores
  ?region_id=eq.<uuid>&order=period_end.desc&limit=1
  &select=period_start,period_end,gw_stress_index,gw_stress_class,components,confidence,
          provenance(source,processing_version,model_run_id,parameters),
          confidence_scores(score,level,factors)
```

### 2.5 `GET /rest/v1/predictions`
Model outputs incl. SHAP; embed provenance + confidence.
```
GET /rest/v1/predictions?region_id=eq.<uuid>&model_id=eq.<uuid>&order=pred_date.desc
  &select=pred_date,class,value,probability,shap,confidence,provenance(processing_version,model_run_id)
```

### 2.6 `GET /rest/v1/alerts`, `GET /rest/v1/map_layers`, `GET /rest/v1/validation_records`
Standard reads; alerts ordered by `triggered_at.desc`; map_layers feed the map UI; validation_records support [16-validation-framework](./16-validation-framework.md) and Judge Mode.

> **PostgREST OpenAPI:** Supabase exposes an auto-generated OpenAPI document at the `/rest/v1/` root. The Edge Function endpoints below are specified manually in §3.

---

## 3. Edge Functions

All Edge Functions: `Content-Type: application/json`, require `apikey` + `Authorization` headers, enforce role, validate input, write an `audit_log` row on side effects, and return the standard envelope (§1.6) or the error model (§1.7).

### 3.1 `ee-compute` — on-demand EO computation
- **Method/path:** `POST /functions/v1/ee-compute`
- **Auth/role:** analyst or admin.
- **Purpose:** Run an EO pipeline for an AOI/region + indicators + period; persist `indicator_values` + `provenance`; return values with confidence. Delegates to the EE Worker ([03](./03-system-architecture.md) §5.2). Long runs return `202` + job id.
- **Side effects:** upsert ad-hoc `regions` (AOI), insert `provenance`, `indicator_values`, `confidence_scores`, `audit_log`. **Idempotency:** keyed by `(aoi hash, indicators, period, processing_version)`.
- **Rate limit:** 10/min, 100/day.

**Request schema:**
```json
{
  "region_id": "uuid (optional if aoi provided)",
  "aoi": { "type": "Polygon", "coordinates": [[[36.0,31.5],[36.5,31.5],[36.5,32.0],[36.0,32.0],[36.0,31.5]]] },
  "indicators": ["ndvi","ndwi","surface_water_extent_km2"],
  "period": { "start": "2026-05-01", "end": "2026-05-31" },
  "options": { "cloud_prob_threshold": 50, "composite": "median" }
}
```
**Response schema (200):** standard envelope; `data` =
```json
{
  "region_id": "uuid",
  "results": [
    { "indicator": "ndvi", "obs_date": "2026-05-31", "value": 0.42,
      "provenance_id": "uuid", "confidence": {"score":0.83,"level":"High"} }
  ]
}
```
**Response (202 Accepted, long job):**
```json
{ "data": { "job_id": "job_01J...", "status": "running" },
  "meta": { "poll": "/functions/v1/ee-compute?job_id=job_01J..." } }
```
**Errors:** 400 (bad/oversized AOI), 403, 422 (no imagery in period), 502 (GEE), 504 (→ use 202).

**curl:**
```bash
curl -X POST "$BASE/functions/v1/ee-compute" \
  -H "apikey: $ANON" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"aoi":{"type":"Polygon","coordinates":[[[36.0,31.5],[36.5,31.5],[36.5,32.0],[36.0,32.0],[36.0,31.5]]]},
       "indicators":["ndvi","ndwi"],"period":{"start":"2026-05-01","end":"2026-05-31"}}'
```

**OpenAPI snippet:**
```yaml
paths:
  /functions/v1/ee-compute:
    post:
      summary: On-demand EO computation for an AOI/region
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/EeComputeRequest' }
      responses:
        '200': { description: Values + provenance + confidence,
                 content: { application/json: { schema: { $ref: '#/components/schemas/Envelope' } } } }
        '202': { description: Long-running job accepted }
        '400': { $ref: '#/components/responses/ValidationError' }
        '502': { $ref: '#/components/responses/UpstreamError' }
```

---

### 3.2 `risk-score` — groundwater-stress index
- **Method/path:** `POST /functions/v1/risk-score`
- **Auth/role:** analyst or admin (viewer/judge read stored results via PostgREST §2.4).
- **Purpose:** Compute `gw_stress_index` (0–100) + class from stored components for region+period (weights: abstraction 0.30, recharge deficit 0.25, veg–water divergence 0.20, surface-water decline 0.15, GRACE 0.10 — see [08-risk-scoring](./08-risk-scoring.md)); persist `risk_scores` + `risk_factors` + `provenance` + `confidence`.
- **Side effects:** insert `risk_scores`, `risk_factors`, `provenance` (model_run linkage), `confidence_scores`, `audit_log`.
- **Rate limit:** 30/min.

**Request:**
```json
{ "region_id": "uuid", "period": { "start": "2026-05-01", "end": "2026-05-31" }, "recompute": false }
```
**Response data:**
```json
{
  "region_id": "uuid",
  "period": { "start":"2026-05-01","end":"2026-05-31" },
  "gw_stress_index": 63.4,
  "gw_stress_class": "High",
  "components": {
    "abstraction_pressure":   {"value":0.71,"weight":0.30},
    "recharge_deficit":       {"value":0.66,"weight":0.25},
    "veg_water_divergence":   {"value":0.58,"weight":0.20},
    "surface_water_decline":  {"value":0.62,"weight":0.15},
    "regional_storage_grace": {"value":0.40,"weight":0.10}
  }
}
```
plus `provenance` (model_run_id of `gw_stress_model`) and `confidence`.
**Errors:** 403, 404 (region), 422 (insufficient component data → no fabrication).

**curl:**
```bash
curl -X POST "$BASE/functions/v1/risk-score" -H "apikey: $ANON" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"region_id":"<azraq-uuid>","period":{"start":"2026-05-01","end":"2026-05-31"}}'
```

---

### 3.3 `ai-insights` — grounded natural-language explanation
- **Method/path:** `POST /functions/v1/ai-insights`
- **Auth/role:** viewer, analyst, admin, judge (all may read explanations).
- **Purpose:** Generate a **strictly grounded** explanation over stored metrics + provenance for a region/period/question; OpenAI key is server-side; output cites the provenance it used. If no grounded data exists → returns "insufficient data", never invents ([03](./03-system-architecture.md) §5.3).
- **Side effects:** `audit_log` (prompt hash + sources used). No metric writes.
- **Rate limit:** 20/min, 300/day.

**Request:**
```json
{ "region_id": "uuid", "period": { "start":"2026-01-01","end":"2026-05-31" },
  "question": "Why is groundwater stress rising in Azraq?", "lang": "en" }
```
**Response data:**
```json
{
  "text": "Groundwater stress in the Azraq Basin rose from Moderate to High over the period, driven mainly by increased abstraction pressure (irrigated area +12%) and a recharge deficit following below-average rainfall (SPI-6 = -1.4)...",
  "citations": ["<provenance_id_1>","<provenance_id_2>"]
}
```
plus `provenance` (the cited sources) and `confidence` (aggregate of cited metrics). `lang` ∈ {en, ar}.
**Errors:** 403, 422 (no grounded data), 502 (OpenAI), 503.

**Guardrails:** the function (1) retrieves facts from Postgres, (2) injects them into the prompt with a no-fabrication system instruction, (3) post-filters claims not traceable to a retrieved fact. See [17-security](./17-security.md).

**curl:**
```bash
curl -X POST "$BASE/functions/v1/ai-insights" -H "apikey: $ANON" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"region_id":"<azraq-uuid>","period":{"start":"2026-01-01","end":"2026-05-31"},
       "question":"Why is groundwater stress rising in Azraq?","lang":"en"}'
```

---

### 3.4 `scenario-run` — what-if digital twin
- **Method/path:** `POST /functions/v1/scenario-run`
- **Auth/role:** analyst or admin.
- **Purpose:** Apply scenario deltas (e.g., +15% irrigated area, −20% rainfall) to the transparent water-balance/risk model and recompute `gw_stress_index`; persist `scenarios` (if new) + `scenario_results` + `provenance` + `confidence`. Outputs labeled "modeled/what-if" ([10-digital-twin](./10-digital-twin.md)).
- **Side effects:** insert `scenarios`/`scenario_results`/`provenance`/`confidence_scores`/`audit_log`.
- **Rate limit:** 20/min.

**Request:**
```json
{
  "region_id": "uuid",
  "scenario": {
    "name": "Drought + expansion",
    "baseline_period": { "start":"2025-05-01","end":"2025-05-31" },
    "params": { "irrigated_area_pct": 15, "precip_pct": -20, "irrigation_efficiency_pct": -5 }
  }
}
```
**Response data:**
```json
{
  "scenario_id": "uuid",
  "gw_stress_index": 78.9,
  "gw_stress_class": "Severe",
  "delta_vs_baseline": { "gw_stress_index": +15.5, "class_shift": "High→Severe" },
  "components": { "abstraction_pressure": {"value":0.86,"weight":0.30}, "...": {} }
}
```
plus `provenance` (scenario model_run + params) and `confidence` (includes a scenario-assumption factor).
**Errors:** 400 (invalid params), 403, 422 (no baseline data).

**curl:**
```bash
curl -X POST "$BASE/functions/v1/scenario-run" -H "apikey: $ANON" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"region_id":"<azraq-uuid>","scenario":{"name":"Drought + expansion",
       "baseline_period":{"start":"2025-05-01","end":"2025-05-31"},
       "params":{"irrigated_area_pct":15,"precip_pct":-20}}}'
```

---

### 3.5 `report-generate` — assemble & export a report
- **Method/path:** `POST /functions/v1/report-generate`
- **Auth/role:** analyst or admin.
- **Purpose:** Gather metrics/risk/validation/provenance for a region+period, optionally call `ai-insights` per section, resolve figures via `tiles`, render a PDF to Storage, and persist `reports` + `report_sections`. Returns a signed URL ([15-report-generator](./15-report-generator.md)).
- **Side effects:** Storage PDF (+ optional CSV/GeoJSON), insert `reports`/`report_sections`/`audit_log`. Long renders return `202` + `report_id`.
- **Rate limit:** 5/min, 50/day.

**Request:**
```json
{
  "region_id": "uuid",
  "period": { "start":"2026-01-01","end":"2026-05-31" },
  "sections": ["overview","rainfall","vegetation","surface_water","risk","provenance_appendix"],
  "lang": "en",
  "include": { "ai_narrative": true, "figures": true, "exports": ["csv"] }
}
```
**Response data:**
```json
{ "report_id":"uuid","status":"succeeded","url":"https://…/storage/v1/object/sign/reports/…pdf?token=…",
  "exports": { "csv": "https://…sign…csv?token=…" } }
```
plus `provenance` (all sources cited) and `confidence` (aggregate).
**Errors:** 403, 422 (nothing to report), 502 (figure/AI upstream).

**curl:**
```bash
curl -X POST "$BASE/functions/v1/report-generate" -H "apikey: $ANON" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"region_id":"<azraq-uuid>","period":{"start":"2026-01-01","end":"2026-05-31"},
       "sections":["overview","risk","provenance_appendix"],"lang":"en"}'
```

---

### 3.6 `confidence` — compute/return confidence for a metric
- **Method/path:** `POST /functions/v1/confidence`
- **Auth/role:** analyst or admin (results readable by all via embed).
- **Purpose:** Compute the six-factor weighted **geometric mean** confidence (freshness 0.20, source_quality 0.20, spatial_coverage 0.20, temporal_completeness 0.15, model_validation 0.15, convergence 0.10) for a referenced metric; persist/update `confidence_scores` ([09-confidence-engine](./09-confidence-engine.md)).
- **Side effects:** upsert `confidence_scores`, `audit_log`.
- **Rate limit:** 60/min.

**Request:**
```json
{ "metric_kind": "indicator_value", "metric_id": "uuid" }
```
**Response data:**
```json
{
  "metric_kind": "indicator_value", "metric_id": "uuid",
  "score": 0.83, "level": "High",
  "factors": {
    "freshness": {"value":0.95,"weight":0.20},
    "source_quality": {"value":0.90,"weight":0.20},
    "spatial_coverage": {"value":0.88,"weight":0.20},
    "temporal_completeness": {"value":0.80,"weight":0.15},
    "model_validation": {"value":0.75,"weight":0.15},
    "convergence": {"value":0.70,"weight":0.10}
  }
}
```
**Errors:** 404 (metric not found), 422 (missing factor inputs → low confidence, never fabricated).

**curl:**
```bash
curl -X POST "$BASE/functions/v1/confidence" -H "apikey: $ANON" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" -d '{"metric_kind":"indicator_value","metric_id":"<uuid>"}'
```

---

### 3.7 `alerts` — evaluate & list environmental alerts
- **Method/path:** `POST /functions/v1/alerts` (evaluate) and `GET /functions/v1/alerts` (list) — listing is also available via PostgREST §2.6.
- **Auth/role:** evaluate = admin (or scheduler); list = any; acknowledge = analyst+.
- **Purpose:** Evaluate alert rules against latest metrics (e.g., `gw_stress_class` rises to High/Severe, `spi_3` < −1.5, surface water drop > X%); create `alerts` rows with provenance to the triggering metric.
- **Side effects:** insert `alerts`, `audit_log`; acknowledge updates `alerts.acknowledged`.
- **Rate limit:** 30/min.

**Evaluate request:**
```json
{ "region_id": "uuid (optional; all if omitted)", "rules": ["gw_stress_high","spi3_drought","surface_water_drop"] }
```
**Response data:**
```json
{ "raised": [
    { "id":"uuid","region_id":"uuid","indicator":"gw_stress_index","severity":"warning",
      "title":"Groundwater stress rose to High","triggered_value":63.4,"threshold":50,
      "provenance_id":"uuid","confidence":{"score":0.81,"level":"High"} }
] }
```
plus `provenance` + `confidence` per raised alert.
**Acknowledge:** `POST /functions/v1/alerts` with `{ "acknowledge": "<alert_id>" }` (analyst+).
**Errors:** 403, 422 (no metrics to evaluate).

---

### 3.8 `tiles` — map tile/COG broker
- **Method/path:** `GET /functions/v1/tiles?layer=<key>&...` (and `POST` for parameterized layers).
- **Auth/role:** any (viewer+); honors RLS on `map_layers`.
- **Purpose:** Return an EE `getMapId` tile URL **template** (dynamic) or a **signed COG URL** (pre-exported) for a `map_layers` entry, with vis params + legend ([03](./03-system-architecture.md) §4.10).
- **Side effects:** none persistent (may memoize token short-TTL); `audit_log` optional.
- **Rate limit:** 120/min.

**Request:**
```
GET /functions/v1/tiles?layer=ndvi_azraq_2026_05&z_hint=8
```
**Response data:**
```json
{
  "layer": "ndvi_azraq_2026_05",
  "type": "ee_getmapid",
  "tile_url_template": "https://earthengine.googleapis.com/v1alpha/projects/.../maps/<mapid>/tiles/{z}/{x}/{y}",
  "vis_params": { "bands":["NDVI"], "min":0, "max":1, "palette":["#d73027","#fee08b","#1a9850"] },
  "legend": { "title":"NDVI", "stops":[{"value":0,"color":"#d73027"},{"value":1,"color":"#1a9850"}] },
  "bounds": [36.0,31.5,36.9,32.2],
  "expires_at": "2026-06-10T13:00:00Z"
}
```
For a COG layer, `type:"cog"` and `source_uri` is a signed Storage/GCS URL instead of a tile template. The response also carries `provenance` (the layer's source/`processing_version`) and a `confidence` summary for the underlying metric.
**Errors:** 401/403 (layer access), 404 (unknown layer), 502 (EE token issuance), 503.

**curl:**
```bash
curl "$BASE/functions/v1/tiles?layer=ndvi_azraq_2026_05" -H "apikey: $ANON" -H "Authorization: Bearer $JWT"
```

---

## 4. OpenAPI components (shared schemas)

```yaml
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
  schemas:
    Provenance:
      type: object
      properties:
        id: { type: string, format: uuid }
        source: { type: string }
        dataset_id: { type: string, format: uuid, nullable: true }
        ee_asset_id: { type: string, nullable: true }
        period_start: { type: string, format: date, nullable: true }
        period_end: { type: string, format: date, nullable: true }
        processing_method: { type: string }
        processing_version: { type: string }
        parameters: { type: object, additionalProperties: true }
        model_run_id: { type: string, format: uuid, nullable: true }
        attribution: { type: string, nullable: true }
    ConfidenceFactor:
      type: object
      properties: { value: { type: number }, weight: { type: number } }
    Confidence:
      type: object
      properties:
        score: { type: number, minimum: 0, maximum: 1 }
        level: { type: string, enum: [High, Medium, Low] }
        factors:
          type: object
          properties:
            freshness: { $ref: '#/components/schemas/ConfidenceFactor' }
            source_quality: { $ref: '#/components/schemas/ConfidenceFactor' }
            spatial_coverage: { $ref: '#/components/schemas/ConfidenceFactor' }
            temporal_completeness: { $ref: '#/components/schemas/ConfidenceFactor' }
            model_validation: { $ref: '#/components/schemas/ConfidenceFactor' }
            convergence: { $ref: '#/components/schemas/ConfidenceFactor' }
    Envelope:
      type: object
      required: [data]
      properties:
        data: { }
        provenance: { type: array, items: { $ref: '#/components/schemas/Provenance' } }
        confidence: { $ref: '#/components/schemas/Confidence' }
        meta:
          type: object
          properties:
            request_id: { type: string }
            generated_at: { type: string, format: date-time }
            processing_version: { type: string }
            cached: { type: boolean }
    Error:
      type: object
      properties:
        error:
          type: object
          properties:
            code: { type: string }
            message: { type: string }
            details: { type: object, additionalProperties: true }
            request_id: { type: string }
  responses:
    ValidationError: { description: Invalid request,
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
    UpstreamError: { description: Upstream (GEE/OpenAI) failure,
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
```

---

## 5. Scheduled triggers & webhooks

| Trigger | Mechanism | Target | Cadence | Notes |
|---------|-----------|--------|---------|-------|
| Scheduled indicator computation | Cloud Scheduler → Pub/Sub → Cloud Run (EE Worker) | EE Worker (not a public HTTP endpoint) | per dataset cadence ([04](./04-data-sources.md) §6) | Writes values + provenance; then triggers `confidence`. |
| Risk recompute | Cloud Scheduler → `risk-score` (service token) | `risk-score` | post-ingest (e.g., daily/weekly) | Refreshes `risk_scores` + materialized views. |
| Alert evaluation | Cloud Scheduler → `alerts` (service token) | `alerts` (evaluate) | hourly/daily | Raises `alerts`; may notify (out of scope here). |
| Materialized view refresh | Scheduled SQL (pg_cron / scheduler) | `mv_latest_indicator`, `mv_latest_risk` | after ingest | Keeps hot reads fast ([11](./11-database-schema.md) §12). |
| DB webhooks (optional) | Supabase Database Webhooks | external/notify | on insert to `alerts` | E.g., push notification fan-out. |

Scheduled invocations of Edge Functions authenticate with a **service identity token** (not a user JWT); they bypass user rate limits but are themselves rate-bounded by the scheduler config ([17-security](./17-security.md), [18-deployment](./18-deployment.md)).

---

## 6. Endpoint → consuming page mapping

| Endpoint | Consuming page(s) | Use |
|----------|-------------------|-----|
| `GET /rest/v1/regions` | all map pages, `/`, `/azraq` | Region selectors, geometry. |
| `GET /rest/v1/indicators`,`/datasets` | `/validation`, `/judge`, `/satellite` | Catalogs, attribution. |
| `GET /rest/v1/indicator_values` (+embed) | `/`, `/map`, `/azraq`, `/satellite` | Time-series charts (Recharts) with envelope. |
| `GET /rest/v1/risk_scores` (+embed) | `/` (National Command Center), `/azraq`, `/judge` | Headline stress index + components. |
| `GET /rest/v1/predictions` | `/satellite`, `/ai`, `/twin` | Crop/irrigation classes + SHAP. |
| `GET /rest/v1/alerts` | `/`, `/map` | Alert feed. |
| `GET /rest/v1/map_layers` | `/map`, `/azraq`, `/satellite` | Layer catalog. |
| `GET /rest/v1/validation_records` | `/validation`, `/judge` | Validation evidence. |
| `POST /functions/v1/ee-compute` | `/map`, `/azraq`, `/satellite` | On-demand AOI analysis. |
| `POST /functions/v1/risk-score` | `/azraq`, `/` | Compute/refresh stress. |
| `POST /functions/v1/ai-insights` | `/ai`, `/azraq`, `/judge` | Grounded narrative. |
| `POST /functions/v1/scenario-run` | `/twin` | What-if digital twin. |
| `POST /functions/v1/report-generate` | `/reports` | Export PDF. |
| `POST /functions/v1/confidence` | `/validation`, `/judge` | Inspect/refresh confidence. |
| `POST/GET /functions/v1/alerts` | `/`, `/map` | Evaluate/list/ack alerts. |
| `GET /functions/v1/tiles` | `/map`, `/azraq`, `/satellite`, `/twin` | Tile/COG brokering for MapLibre/deck.gl. |

(Pages defined in [13-ui-pages](./13-ui-pages.md); Judge Mode in [14-judge-mode](./14-judge-mode.md).)

---

## 7. Worked end-to-end example (Azraq, on-demand → narrative)

1. **Compute** indicators for the Azraq AOI:
   `POST /functions/v1/ee-compute` → returns NDVI/NDWI/surface-water values, each with `provenance_id` + confidence.
2. **Score** stress:
   `POST /functions/v1/risk-score` → `gw_stress_index: 63.4`, class `High`, components + confidence.
3. **Explain** (grounded):
   `POST /functions/v1/ai-insights` (`question:"Why is stress High?"`) → text citing the exact provenance ids from steps 1–2; confidence = aggregate of cited metrics.
4. **Visualize:** `GET /functions/v1/tiles?layer=ndvi_azraq_…` for the map; `GET /rest/v1/risk_scores?...&select=...provenance,confidence_scores` for charts.
5. **Report:** `POST /functions/v1/report-generate` bundles the above into a PDF with a provenance appendix.

At every step the response carries **provenance + confidence**, and no number appears that cannot be traced to Earth Engine, a stored dataset, or a model output — fulfilling the MIZAN contract.

---

## 8. Summary of guarantees

1. **Auth everywhere:** JWT + RLS + per-function role checks; secrets server-side only.
2. **Provenance + confidence on every value** — via PostgREST embeds and the Edge envelope.
3. **No fabrication:** absence of grounded data yields `422`/explanatory null, never a made-up value; AI is grounded-and-cited.
4. **Predictable errors & limits:** uniform error model, documented codes, and rate limits with `Retry-After`.
5. **Reproducibility:** `processing_version` + provenance `parameters` accompany results.
6. **Long jobs are async:** heavy compute returns `202` + job id rather than timing out.
7. **OpenAPI-described:** PostgREST self-documents; Edge Functions specified here with schemas + examples — build-from-docs-alone.
