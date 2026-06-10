# 14 — Judge Mode

| Field        | Value                                                                                                                                                                                   |
|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Document     | 14-judge-mode.md                                                                                                                                                                        |
| Project      | MIZAN — Earth Observation Environmental Intelligence for Jordan                                                                                                                         |
| Version      | 0.1 (Draft)                                                                                                                                                                             |
| Status       | Phase 1 — Specification                                                                                                                                                                 |
| Last updated | 2026-06-10                                                                                                                                                                              |
| Related      | [13-ui-pages](13-ui-pages.md) · [16-validation-framework](16-validation-framework.md) · [19-astrocode-compliance](19-astrocode-compliance.md) · [11-database-schema](11-database-schema.md) · [12-api-specification](12-api-specification.md) · [10-digital-twin](10-digital-twin.md) · [15-report-generator](15-report-generator.md) |

---

## Purpose

Judge Mode is a guided, self-explaining evaluation experience at `/judge`, designed specifically for AstroCode competition judges (and authorized reviewers). It removes all ambiguity about what MIZAN does, what it computes, where its data originates, and how it maps to each AstroCode deliverable — presenting live evidence for every claim in a structured, step-by-step tour.

Every number displayed in Judge Mode is identical to the number shown in the live platform: Judge Mode never fabricates, simplifies, or replaces data. It surfaces the same stored metrics, the same provenance records, and the same confidence scores, but wraps them in an ordered evaluation script with rich contextual explanation.

**Deliverables mapping:** Functional Prototype · Data Explanation · AI/Analytics Method · Results Visualization · Jordanian Use Case · Impact Statement (all six — this page is the meta-demonstration)

---

## 1. Concept & Goals

### 1.1 The Evaluation Problem

AstroCode judges must assess six deliverables across a complex, data-intensive platform in limited time. Without guidance they face:

- Difficulty knowing *where* each deliverable is demonstrated.
- Uncertainty about whether displayed numbers are real or placeholder.
- No clear path from a metric value to its source, methodology, and confidence.
- No single place to verify that all six deliverables are substantively met.

### 1.2 Judge Mode Solution

Judge Mode solves this by providing:

1. **A guided tour** — an ordered sequence of 8 steps, each mapped to one or more AstroCode deliverables, with on-screen narrative and live evidence.
2. **Live Deliverables Checklist** — a persistent overlay showing all 6 deliverables with their current "seen / demonstrated" status, updated as the judge progresses through the tour.
3. **"Explain this number" affordance** — a one-click button on every displayed value that opens a full-panel provenance record, methodology explanation, and confidence justification.
4. **"Behind the Numbers" panels** — for key computations (risk index, water balance, scenario engine), a collapsible panel showing every equation step with real variable values.
5. **Scientific-integrity statements** — non-dismissable sidebar cards that proactively state what MIZAN does NOT claim, preventing misinterpretation.
6. **Reproducible Demo State** — a fixed reference dataset (Azraq Basin, reference period Q3 2023) of real, cached EO results that loads consistently regardless of whether live GEE is available, so the demo always works and is always identical.
7. **Talking points** — judge-facing text on each step summarising the key evidence and its significance.
8. **Scoring-rubric alignment** — each step is tagged with the AstroCode rubric criteria it satisfies.

### 1.3 Design Principles

- **No fabrication, ever.** All values in Judge Mode are drawn from the demo snapshot of the `indicator_values`, `risk_scores`, `scenario_results`, and `provenance` tables. Nothing is hardcoded in the frontend; everything is queried from Supabase just as in the live platform.
- **Transparent by default.** Every metric in Judge Mode has its `ValidationEnvelope` visible or one click away.
- **Self-contained.** Judge Mode should be completable without the judge needing to navigate to other pages, though deep links into `/azraq`, `/validation`, and `/twin` are provided for those who want more detail.
- **Timed guidance.** Each step includes an estimated reading time (2–4 minutes), so judges can pace themselves. Total estimated tour time: ~25 minutes.

---

## 2. Access Control

### 2.1 Roles with Access

| Role | Access |
|------|--------|
| `judge` | Full access to `/judge` including all tour steps and demo state |
| `admin` | Full access (for testing and content management) |
| `analyst` | Read-only access; cannot modify demo state |
| `viewer` | No access (redirected to `/` with "Insufficient permissions" toast) |

### 2.2 Route Protection

```typescript
// src/router.tsx
{
  path: 'judge',
  element: (
    <ProtectedRoute roles={['judge', 'admin']}>
      <JudgeMode />
    </ProtectedRoute>
  )
}
```

The `ProtectedRoute` component reads the current user's role from `profiles.role` (fetched on auth). If the role is not in the allowed list, it renders a `<Navigate to="/" replace />` with an `AlertBanner` notification.

### 2.3 Entering Judge Mode

**Method 1 — Direct URL:** Navigate to `/judge`. If authenticated as `judge` or `admin`, the tour starts automatically.

**Method 2 — Nav bar link:** The nav bar shows a "Judge Mode" link (Gavel icon) only for `judge` and `admin` roles.

**Method 3 — Welcome modal on first login:** When a `judge` role user logs in for the first time, a welcome modal appears:

```
┌──────────────────────────────────────────────────────┐
│  Welcome to MIZAN — Judge Evaluation Mode           │
│                                                      │
│  You have been granted judge access. Would you like  │
│  to start the guided evaluation tour? (~25 minutes)  │
│                                                      │
│  [Start Guided Tour]  [Explore freely first]         │
│                                                      │
│  The guided tour walks through all 6 AstroCode      │
│  deliverables with live evidence, provenance         │
│  records, and methodology explanations.              │
└──────────────────────────────────────────────────────┘
```

### 2.4 Exiting Judge Mode

The tour can be exited at any time via:
- The "Exit Tour" button in the top-right of the guided tour overlay.
- Pressing `Escape` twice (first Escape closes any open panel; second Escape exits tour).
- Navigating to any other page via the nav bar (the tour state is preserved in Zustand and can be resumed).

---

## 3. Demo State — Reproducible Reference Dataset

### 3.1 What the Demo State Is

The demo state is a **frozen snapshot** of real EO-computed results for Azraq Basin, reference period **Q3 2023 (July–September 2023)**, stored in the `judge_demo_snapshots` table in Supabase. It is:

- **Real data:** All values were computed by the MIZAN Google Earth Engine pipeline from actual Sentinel-1/2, CHIRPS, and ERA5 data. They are not synthetic or fabricated.
- **Frozen:** The snapshot is write-protected; no background recomputation can alter it.
- **Labeled:** Every number in Judge Mode shows a "(Demo 2023-Q3)" tag to distinguish it from live, continuously-updated data.
- **Self-consistent:** All sub-indices, scenarios, and provenance records in the demo state reference the same Q3 2023 computation run.
- **Offline-capable:** The demo state is small enough to be bundled as a JSON asset (`public/demo/azraq-q3-2023.json`) for offline/fallback use if Supabase is unreachable.

### 3.2 Demo State Contents

> **Specification note.** Demo-state figures shown throughout this document — including the JSON below — are **illustrative of structure and format**, using realistic placeholder values for Azraq; they are **not** actual measurements. In the running system the demo snapshot is populated *exclusively* with **real values computed by the MIZAN Earth Engine pipeline** (see [05-earth-engine-pipelines](./05-earth-engine-pipelines.md)), carried with full provenance and confidence — never hand-entered. Until those pipelines have run, treat every demo figure here as illustrative.

```json
{
  "snapshot_id":    "demo-azraq-q3-2023",
  "region":         "Azraq Basin",
  "region_id":      "uuid-azraq",
  "reference_date": "2023-09-30",
  "label":          "Demo Snapshot — Azraq Basin Q3 2023",
  "note":           "Illustrative values for this specification; the production snapshot holds real EO-computed values, frozen for reproducible evaluation.",

  "indicators": {
    "ndvi":                    { "value": 0.21,  "unit": "index",  "confidence": "High",   "confidence_score": 0.88 },
    "ndvi_anomaly":            { "value": -0.08, "unit": "index",  "confidence": "High",   "confidence_score": 0.85 },
    "evi":                     { "value": 0.16,  "unit": "index",  "confidence": "High",   "confidence_score": 0.87 },
    "ndwi":                    { "value": -0.31, "unit": "index",  "confidence": "High",   "confidence_score": 0.84 },
    "surface_water_extent_km2":{ "value": 11.2,  "unit": "km²",   "confidence": "High",   "confidence_score": 0.91 },
    "s1_rvi":                  { "value": 0.14,  "unit": "index",  "confidence": "Medium", "confidence_score": 0.61 },
    "soil_moisture_proxy":     { "value": 0.22,  "unit": "m³/m³", "confidence": "Medium", "confidence_score": 0.58 },
    "precip_mm":               { "value": 3.1,   "unit": "mm/mo", "confidence": "High",   "confidence_score": 0.93 },
    "spi_3":                   { "value": -1.42, "unit": "index",  "confidence": "High",   "confidence_score": 0.90 },
    "spi_12":                  { "value": -1.18, "unit": "index",  "confidence": "High",   "confidence_score": 0.89 },
    "et0_pm_mm":               { "value": 7.8,   "unit": "mm/day","confidence": "High",   "confidence_score": 0.86 },
    "etc_mm":                  { "value": 7.2,   "unit": "mm/day","confidence": "Medium", "confidence_score": 0.72 },
    "irrigated_area_ha":       { "value": 18450, "unit": "ha",     "confidence": "High",   "confidence_score": 0.82 },
    "agri_expansion_pct":      { "value": 34.2,  "unit": "%",      "confidence": "Medium", "confidence_score": 0.76 },
    "recharge_proxy_mm":       { "value": 4.8,   "unit": "mm/yr", "confidence": "Medium", "confidence_score": 0.63 },
    "abstraction_estimate_mcm":{ "value": 74.2,  "unit": "MCM/yr","confidence": "Medium", "confidence_score": 0.67 },
    "water_balance_mcm":       { "value": -61.4, "unit": "MCM/yr","confidence": "Medium", "confidence_score": 0.64 }
  },

  "risk_score": {
    "gw_stress_index":           74.3,
    "gw_stress_class":           "Severe",
    "sub_index_abstraction":     85.1,
    "sub_index_recharge":        72.4,
    "sub_index_veg_water":       68.0,
    "sub_index_surface_water":   79.2,
    "sub_index_storage":         71.1,
    "confidence_score":          0.82,
    "confidence_level":          "High"
  },

  "demo_scenario": {
    "name":                  "Business-as-usual projection (Demo)",
    "horizon_years":         5,
    "reference_year":        2023,
    "gw_stress_trajectory":  [74.3, 77.1, 80.2, 83.4, 86.1, 88.7],
    "water_balance_traj":    [-61.4, -64.2, -67.1, -70.3, -73.8, -77.2],
    "p10_stress_traj":       [69.0, 71.5, 74.2, 77.0, 79.5, 82.0],
    "p90_stress_traj":       [79.6, 82.7, 86.2, 89.8, 92.4, 95.3],
    "confidence_level":      "Medium"
  }
}
```

### 3.3 Demo State Loading Logic

```typescript
async function loadDemoState(): Promise<DemoSnapshot> {
  try {
    // Try Supabase first (live demo snapshot)
    const { data } = await supabase
      .from('judge_demo_snapshots')
      .select('*')
      .eq('snapshot_id', 'demo-azraq-q3-2023')
      .single();
    return data;
  } catch {
    // Fallback to bundled static JSON
    const fallback = await import('/demo/azraq-q3-2023.json');
    return fallback.default;
  }
}
```

---

## 4. Tour Structure — 8 Steps

The guided tour is an ordered sequence of full-screen (or near-full-screen) step panels. Each step:
- Has a title, an AstroCode deliverable tag, an estimated time, and a "talking points" section for the judge.
- Displays live demo-state data with full ValidationEnvelope access.
- Has a "Next Step" button and a progress indicator.

### Tour Progress Indicator

```
Step [3 / 8]: AI/Analytics Method
●●●○○○○○  ← 8 dots; filled = visited

[← Previous]  [Step 3: AI/Analytics Method]  [Next →]
[Exit Tour]                           [Jump to step ▾]
```

---

### Step 1 — What MIZAN Does (Orientation)

**Deliverable:** (Context-setting; all deliverables)
**Estimated time:** 2 minutes

**Layout:**

```
┌───────────────────────────────────────────────────────────────────┐
│  STEP 1: Orientation — What MIZAN Is and Is Not                   │
├──────────────────────┬────────────────────────────────────────────┤
│  NARRATIVE PANEL     │  LIVE PLATFORM PREVIEW                    │
│  (40%)               │  (60%)                                    │
│                      │                                           │
│  MIZAN (ميزان) means │  [Mini-map: Jordan choropleth             │
│  "balance" in Arabic.│   with gw_stress_class colors]           │
│                      │                                           │
│  It transforms Earth │  [4 KPI cards from demo state]:          │
│  Observation data    │  GW Stress 74.3 [● High conf]            │
│  into groundwater    │  Irrigated Area 18,450 ha [● High]       │
│  stress INDICATORS   │  SPI-12 −1.18 [● High]                  │
│  for Jordan.         │  Water Balance −61 MCM [● Med]           │
│                      │                                           │
│  ⚠ WHAT IT IS NOT:   │  [Click any value → Explain this number] │
│  • Not a calibrated  │                                           │
│    groundwater model │                                           │
│  • Not a direct      │                                           │
│    observation of    │                                           │
│    water table level │                                           │
│  • Makes no legal    │                                           │
│    determination     │                                           │
│                      │                                           │
│  TALKING POINTS:     │                                           │
│  "MIZAN uses 5 proxy │                                           │
│  EO indicators to    │                                           │
│  estimate stress, not│                                           │
│  observe it. Every   │                                           │
│  number is traceable │                                           │
│  to its satellite    │                                           │
│  source."            │                                           │
└──────────────────────┴────────────────────────────────────────────┘
```

---

### Step 2 — Jordanian Use Case (Azraq Basin)

**Deliverable:** Jordanian Use Case
**Estimated time:** 3 minutes

**Content:**
- Full context of Azraq Basin: area (~12,700 km²), location (NE Jordan), significance (RAMSAR wetland, agricultural hub, documented over-abstraction).
- Live demo-state map of Azraq with irrigated-area polygons, oasis extent, and stress heatmap.
- `agri_expansion_pct` = 34.2% growth since 2015 highlighted with "Explain this number".
- `surface_water_extent_km2` = 11.2 km² shown with historical context.
- Talking points: "This is not a theoretical basin — Azraq has experienced documented groundwater stress, RAMSAR wetland threats, and agricultural intensification, all of which MIZAN can track via satellite proxies."

**"Explain this number" panels on this step:**
- `agri_expansion_pct` → source: Sentinel-2 LULC change detection 2015–2023; confidence High 0.76.
- `surface_water_extent_km2` → source: JRC Monthly Water History + Sentinel-1 composite; confidence High 0.91.

---

### Step 3 — Data Explanation (EO Sources & Processing)

**Deliverable:** Data Explanation
**Estimated time:** 4 minutes

**Layout:**

```
┌───────────────────────────────────────────────────────────────────┐
│  STEP 3: Data Explanation — How EO Data Becomes Indicators        │
├───────────────────────────────────────────────────────────────────┤
│  DATA PIPELINE DIAGRAM (Mermaid rendered as SVG):                 │
│                                                                   │
│  Sentinel-2 ──→ [GEE: NDVI/EVI/NDWI] ──→ [indicator_values]     │
│  Sentinel-1 ──→ [GEE: S1-VV/VH/RVI]  ──→ [indicator_values]     │
│  CHIRPS      ──→ [GEE: precip/SPI]    ──→ [indicator_values]     │
│  ERA5        ──→ [GEE: ET₀/ETc]       ──→ [indicator_values]     │
│                         ↓                                        │
│                   [risk-score Edge Fn] ──→ [risk_scores]         │
│                         ↓                                        │
│                  [confidence Edge Fn]  ──→ [confidence_scores]   │
│                         ↓                                        │
│                   [provenance table]                             │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│  INDICATOR REFERENCE TABLE (scrollable):                         │
│  Code | Satellite | Formula | GEE Collection | Demo Value | [●]  │
│  ndvi | S2        | (B8−B4)/(B8+B4) | S2_SR | 0.21 | [● High]  │
│  ...  | ...       | ...      | ...   | ...   | [● ...]          │
│                                                                   │
│  [Click any row → Full provenance record in side drawer]         │
├───────────────────────────────────────────────────────────────────┤
│  TALKING POINTS:                                                  │
│  "Every indicator shown in MIZAN has a documented GEE collection, │
│  band formula, and provenance record. No indicator is invented    │
│  or approximated without disclosure."                            │
└───────────────────────────────────────────────────────────────────┘
```

---

### Step 4 — AI/Analytics Method (Risk Scoring)

**Deliverable:** AI/Analytics Method
**Estimated time:** 4 minutes

**Content:**
- Full sub-index risk scoring model: 5 inputs, weightings (0.30/0.25/0.20/0.15/0.10), aggregation formula.
- Live demo-state `SubIndexRadar` chart showing all 5 sub-indices for Q3 2023.
- "Behind the Numbers" panel open by default, showing:

```
  gw_stress_index = 0.30 × 85.1 + 0.25 × 72.4 + 0.20 × 68.0
                  + 0.15 × 79.2 + 0.10 × 71.1
                = 25.53 + 18.10 + 13.60 + 11.88 + 7.11
                = 74.3  [Severe]
```

- Confidence engine explanation: how confidence_score 0.82 was derived (data completeness, temporal gap, spatial resolution factors).
- SPI explanation: "SPI-12 of −1.18 indicates moderate to severe multi-year precipitation deficit. The SPI uses a gamma distribution fitted to historical CHIRPS data 1981–present."
- FAO-56 ET₀ explanation with Penman-Monteith formula reference.
- Talking points: "The risk score is not a black box — every weight, formula, and input is documented and reproduced here. The methodology is based on established remote-sensing and hydrological literature."

**"Explain this number" panels:**
- `gw_stress_index` 74.3 → full equation trace, confidence High 0.82.
- `sub_index_abstraction` 85.1 → methodology: "derived from irrigated_area_ha × (ETc − eff_rain) / irrigation_efficiency, normalized to 0–100 scale using basin historical maximum."

---

### Step 5 — Functional Prototype (Live Demo)

**Deliverable:** Functional Prototype
**Estimated time:** 5 minutes

This step is the most interactive — it demonstrates the live, working system.

**Layout:**

```
┌───────────────────────────────────────────────────────────────────┐
│  STEP 5: Functional Prototype — Live Platform Evidence            │
├───────────────────────────────────────────────────────────────────┤
│  LIVE FEATURE CHECKLIST (left, 30%):                             │
│                                                                   │
│  ✓ Interactive map with layer switching                          │
│  ✓ Time slider (2015–2024)                                       │
│  ✓ Multi-indicator dashboard                                     │
│  ✓ AI Q&A (live query)                                           │
│  ✓ Digital Twin scenario engine                                  │
│  ✓ Report generation                                             │
│  ✓ Bilingual EN/AR                                               │
│  ✓ ValidationEnvelope on all metrics                             │
│  ✓ Confidence scores on all outputs                              │
│                                                                   │
│  LINKS TO LIVE FEATURES:                                         │
│  [Open Azraq Page →]                                             │
│  [Open Map →]                                                    │
│  [Open Digital Twin →]                                           │
│  [Ask AI about Azraq →]                                          │
│  [Generate Report →]                                             │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  EMBEDDED MINI-DEMO (right, 70%):                                │
│                                                                   │
│  [Azraq map with real layers, time-slider active]                │
│                                                                   │
│  [LIVE API CALL TRACE panel — shows last Supabase query          │
│   and response for the active indicator, so judges can           │
│   verify that data is coming from a real backend, not            │
│   a mock]:                                                       │
│                                                                   │
│  > GET /rest/v1/indicator_values                                  │
│    ?region_id=eq.{azraq}&indicator_code=eq.gw_stress_index      │
│    &date=eq.2023-09-30                                           │
│  < 200 OK  {"indicator_code":"gw_stress_index","value":74.3,...} │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

The **API Call Trace panel** is a judge-mode-exclusive component that intercepts TanStack Query requests and displays the raw request URL and response payload (truncated to 400 chars). This provides direct, incontrovertible evidence that the values shown are coming from a live Supabase backend, not hardcoded in the frontend.

---

### Step 6 — Results Visualization

**Deliverable:** Results Visualization
**Estimated time:** 3 minutes

**Content:**

A gallery of all MIZAN visualization types, each populated with demo-state data:

```
┌──────────────────────────────────────────────────────────────────┐
│  STEP 6: Results Visualization Gallery                           │
├──────────────────────────────────────────────────────────────────┤
│  [LAYOUT: 2×3 grid of visualization cards]                      │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Choropleth Map   │  │ SubIndex Radar   │  │ Radial Gauge  │  │
│  │ Jordan basins    │  │ 5 sub-indices    │  │ GW Stress 74.3│  │
│  │ stress class     │  │ demo values      │  │ "SEVERE"      │  │
│  │ [● High conf]    │  │ [● High conf]    │  │ [● High conf] │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Area Chart w/ CI │  │ Time Series      │  │ Bar Chart     │  │
│  │ Water balance    │  │ NDVI 2015–2024   │  │ Crop mix      │  │
│  │ p10–p90 bands    │  │ demo data        │  │ irrigated area│  │
│  │ [● Med conf]     │  │ [● High conf]    │  │ [● High conf] │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                  │
│  [3D deck.gl map thumbnail → opens /twin in new tab]            │
│                                                                  │
│  TALKING POINTS:                                                 │
│  "Every chart uses real values from the demo snapshot.           │
│  ValidationEnvelope badges are shown on all charts.             │
│  The 3D Digital Twin uses deck.gl for terrain + stress layers." │
└──────────────────────────────────────────────────────────────────┘
```

---

### Step 7 — Impact Statement

**Deliverable:** Impact Statement
**Estimated time:** 3 minutes

**Content:**

- The MIZAN impact statement, rendered from the database (not hardcoded), with all numeric claims linked to demo-state ValidationEnvelope records.
- Use-case cards for: Farmer irrigation scheduling, National water policy, RAMSAR wetland monitoring, Drought early warning.
- Scenario projection: business-as-usual trajectory showing GW Stress reaching "Severe 88" by 2028, with full uncertainty band and "(Demo scenario — indicative only)" label.
- A quote from the demo AI-insights response about Azraq: "Based on stored EO indicators, Azraq Basin is estimated to be in a state of severe groundwater stress [gw_stress_index 74.3 ● High conf, 2023-09-30]. The estimated water deficit of −61 MCM/yr [● Medium conf] suggests that current abstraction levels significantly exceed recharge — consistent with documented trends in Jordanian hydrogeological literature [external reference, not a MIZAN output]."

---

### Step 8 — Scientific Integrity Review

**Deliverable:** (Meta-deliverable: demonstrates honesty and transparency)
**Estimated time:** 2 minutes

**Content:**

A structured review of all scientific-integrity commitments, each with a live verification affordance:

```
┌───────────────────────────────────────────────────────────────────┐
│  STEP 8: Scientific Integrity — What MIZAN Claims and Does Not    │
├───────────────────────────────────────────────────────────────────┤
│  INTEGRITY CHECKLIST:                                             │
│                                                                   │
│  ✓ ESTIMATES, NOT OBSERVATIONS                                   │
│    MIZAN displays proxy indicators derived from satellite data.  │
│    It never displays direct groundwater level measurements.      │
│    [Verify: click any metric → Explanation always says "proxy"]  │
│                                                                   │
│  ✓ NEVER FABRICATES DATA                                         │
│    Every number originates from GEE or stored datasets.          │
│    [Verify: API Call Trace on Step 5 shows live Supabase query]  │
│                                                                   │
│  ✓ VALIDATION ENVELOPE ON EVERYTHING                             │
│    Every metric has Source, Date, Methodology, Confidence,       │
│    Explanation. No bare numbers anywhere.                        │
│    [Verify: click any KPI card in the platform]                  │
│                                                                   │
│  ✓ SCENARIO DISCLAIMERS ARE NON-REMOVABLE                       │
│    Digital Twin scenario outputs always show the disclaimer      │
│    "indicative simulation, not a prediction."                    │
│    [Verify: open /twin → disclaimer banner persists]             │
│                                                                   │
│  ✓ CONFIDENCE SCORES ARE HONEST                                  │
│    Medium/Low confidence is shown where warranted; the system    │
│    never inflates confidence to appear more certain.             │
│    [Verify: soil_moisture_proxy confidence = Medium 0.58]        │
│                                                                   │
│  ✓ AI IS GROUNDED, NOT CREATIVE                                  │
│    AI responses cite metric record IDs; if data is unavailable,  │
│    AI says so. No hallucination.                                 │
│    [Verify: /ai page → ask about a date with no data →           │
│     AI responds "I don't have data for that period."]            │
│                                                                   │
│  ✓ NO LEGAL DETERMINATION                                        │
│    MIZAN makes no regulatory, legal, or attribution claims.      │
│    This is stated in the platform's non-claims notice.           │
│                                                                   │
│  [Download Scientific Integrity Statement PDF]                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 5. Deliverables Checklist Overlay

The Deliverables Checklist is a persistent, collapsible panel in the lower-right corner of the screen during the Judge Mode tour. It shows all 6 AstroCode deliverables with their status.

### Layout

```
┌─────────────────────────────────┐
│  AstroCode Deliverables   [▼]   │
├─────────────────────────────────┤
│  ✓ Functional Prototype  Step 5 │
│  ✓ Data Explanation      Step 3 │
│  ✓ AI/Analytics Method   Step 4 │
│  ✓ Results Visualization Step 6 │
│  ✓ Jordanian Use Case    Step 2 │
│  ✓ Impact Statement      Step 7 │
├─────────────────────────────────┤
│  Progress: 3/8 steps seen       │
│  [View full compliance →]       │
└─────────────────────────────────┘
```

A deliverable is marked ✓ (green) when the judge has viewed the step(s) that demonstrate it. The status is tracked in Zustand (`judgeDeliverablesSeen: Set<string>`). "View full compliance" links to [19-astrocode-compliance](19-astrocode-compliance.md) rendered inline.

---

## 6. "Explain This Number" Affordance

Every numeric value in Judge Mode has an "Explain this number" button (a small speech-bubble icon, `MessageCircle` from Lucide). Clicking it opens a **full-panel drawer** (not just a popover) with:

```
┌──────────────────────────────────────────────────────────────────┐
│  Explaining: gw_stress_index = 74.3                    [Close ×] │
├──────────────────────────────────────────────────────────────────┤
│  WHAT IS THIS?                                                   │
│  The Groundwater Stress Index (0–100) is MIZAN's composite       │
│  estimate of groundwater stress for Azraq Basin. A score of 74.3 │
│  corresponds to the "Severe" stress class.                       │
│                                                                  │
│  WHERE DOES IT COME FROM?                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Source:       MIZAN risk engine v0.1 + GEE sub-indices    │  │
│  │ GEE Asset:    projects/mizan/assets/azraq_risk_2023Q3     │  │
│  │ Computed at:  2023-10-15T08:32:11Z                        │  │
│  │ Date:         2023-09-30 (Q3 2023 reference period)       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  HOW IS IT CALCULATED?                                           │
│  gw_stress_index = 0.30 × abstraction_sub                        │
│                  + 0.25 × recharge_sub                           │
│                  + 0.20 × veg_water_sub                          │
│                  + 0.15 × surface_water_sub                      │
│                  + 0.10 × storage_sub                            │
│                                                                  │
│  = 0.30 × 85.1 + 0.25 × 72.4 + 0.20 × 68.0                     │
│  + 0.15 × 79.2 + 0.10 × 71.1                                    │
│  = 74.3                                                          │
│                                                                  │
│  CONFIDENCE                                                      │
│  ● High (score: 0.82)                                            │
│  Derived from: data completeness (94%), temporal gap (0 days),   │
│  spatial resolution (10m), methodology maturity (established).   │
│                                                                  │
│  WHAT IT IS NOT                                                  │
│  ⚠ This is NOT a direct measurement of groundwater level,        │
│  aquifer pressure, or pumping rate. It is an EO proxy estimate.  │
│                                                                  │
│  [View full provenance record]  [View methodology doc]          │
│  [Jump to Validation Center →]                                   │
└──────────────────────────────────────────────────────────────────┘
```

The drawer uses Radix UI `<Sheet>` component with `side="right"`, width `min(560px, 90vw)`.

---

## 7. "Behind the Numbers" Panels

For the three core computations (risk score, water balance, scenario projection), Judge Mode exposes a "Behind the Numbers" collapsible panel that shows every intermediate variable with its value, unit, and source:

### Risk Score Behind the Numbers

```
gw_stress_index calculation for Azraq Basin, 2023-09-30:

1. Abstraction sub-index (w=0.30):
   irrigated_area_ha    = 18,450 ha      [Sentinel-2 LULC, GEE, High conf]
   ETc_mm               = 7.2 mm/day     [FAO-56, ERA5 ET₀ × Kc, Med conf]
   eff_rain_mm          = 2.1 mm/day     [CHIRPS × 0.75, High conf]
   irrigation_efficiency= 0.65           [regional literature assumption]
   abstraction_raw      = 18450 × (7.2-2.1)/0.65 = 144,900 m³/day
   abstraction_mcm_yr   = 52.9 MCM/yr   [normalisation to MCM/yr]
   abstraction_sub      = 85.1           [normalized 0–100, basin max ref]

2. Recharge sub-index (w=0.25):
   precip_mm_yr         = 72 mm/yr       [CHIRPS annual, High conf]
   P_threshold          = 75 mm/yr       [stored in scenario metadata]
   recharge_proxy_mm    = 0.12 × max(0, 72-75) = 0 mm/yr
   recharge_proxy_mcm   = 0 MCM/yr       [zero recharge year]
   recharge_sub         = 72.4           [deficit against 10-yr mean]

... [all 5 sub-indices shown] ...

FINAL: 0.30×85.1 + 0.25×72.4 + 0.20×68.0 + 0.15×79.2 + 0.10×71.1 = 74.3
```

---

## 8. Scoring-Rubric Alignment

Each tour step is tagged with the AstroCode rubric criteria it satisfies. This mapping is displayed at the bottom of each step card and in the Deliverables Checklist:

| Step | AstroCode Criterion | Evidence Provided |
|------|---------------------|-------------------|
| 1 | Context & problem definition | Platform overview; Jordan water context |
| 2 | Jordanian Use Case | Azraq Basin live data; regional significance |
| 3 | Data Explanation | EO sources table; GEE collections; provenance records |
| 4 | AI/Analytics Method | Risk score formula; confidence engine; SPI methodology |
| 5 | Functional Prototype | Live API call trace; working features checklist |
| 6 | Results Visualization | Gallery of all chart/map types with live data |
| 7 | Impact Statement | Use cases; scenario projection; Jordan water crisis context |
| 8 | Scientific integrity | Non-claims; confidence honesty; AI grounding verification |

---

## 9. Judge Mode Components

| Component | Description | File |
|---|---|---|
| `JudgeMode` | Page root; loads demo state; renders tour | `pages/JudgeMode.tsx` |
| `TourStep` | Individual step container with nav, progress, timing | `components/judge/TourStep.tsx` |
| `DeliverableChecklist` | Persistent floating checklist overlay | `components/judge/DeliverableChecklist.tsx` |
| `ExplainNumberDrawer` | "Explain this number" full-panel drawer | `components/judge/ExplainNumberDrawer.tsx` |
| `BehindTheNumbers` | Equation trace panel | `components/judge/BehindTheNumbers.tsx` |
| `ApiCallTrace` | Live API request/response display (judge-only) | `components/judge/ApiCallTrace.tsx` |
| `IntegrityChecklist` | Scientific integrity checklist (Step 8) | `components/judge/IntegrityChecklist.tsx` |
| `DemoStateBadge` | "(Demo 2023-Q3)" label appended to all demo values | `components/judge/DemoStateBadge.tsx` |
| `TalkingPoints` | Collapsible talking-points card per step | `components/judge/TalkingPoints.tsx` |

---

## 10. Judge Mode Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` or `n` | Next step |
| `←` or `p` | Previous step |
| `Esc` (×1) | Close open panel/drawer |
| `Esc` (×2) | Exit guided tour |
| `c` | Toggle Deliverables Checklist |
| `b` | Toggle Behind the Numbers panel |
| `e` | Open Explain panel for currently focused metric |
| `?` | Show keyboard shortcuts help |

---

## 11. Mobile & Accessibility

- On screens < 768px, the tour steps use a bottom-sheet layout with the narrative above and the evidence below (stacked, full width).
- The Deliverables Checklist collapses to an icon badge on mobile.
- All judge-mode-specific components meet WCAG 2.1 AA.
- The "Explain this number" drawer has full keyboard navigation and focus trap.
- Tour progress is announced via `aria-live="polite"` on step transition.

---

## 12. Related Documents

| Doc | Relationship |
|-----|-------------|
| [13-ui-pages](13-ui-pages.md) | App shell, nav, ValidationEnvelope, all page specs |
| [16-validation-framework](16-validation-framework.md) | Provenance chain that "Explain this number" exposes |
| [19-astrocode-compliance](19-astrocode-compliance.md) | Deliverables mapping that the Checklist tracks |
| [10-digital-twin](10-digital-twin.md) | Digital Twin evidence shown in Step 5/6 |
| [15-report-generator](15-report-generator.md) | Report export used in Step 7 |
| [08-risk-scoring](08-risk-scoring.md) | Risk methodology shown in Step 4 "Behind the Numbers" |
| [09-confidence-engine](09-confidence-engine.md) | Confidence scoring methodology for Step 4 |
| [11-database-schema](11-database-schema.md) | `judge_demo_snapshots` table; provenance/confidence tables |
| [12-api-specification](12-api-specification.md) | API Call Trace panel in Step 5 |
