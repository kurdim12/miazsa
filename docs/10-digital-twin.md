# 10 — Digital Twin

| Field        | Value                                                                                                                                                                  |
|--------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Document     | 10-digital-twin.md                                                                                                                                                     |
| Project      | MIZAN — Earth Observation Environmental Intelligence for Jordan                                                                                                        |
| Version      | 0.1 (Draft)                                                                                                                                                            |
| Status       | Phase 1 — Specification                                                                                                                                                |
| Last updated | 2026-06-10                                                                                                                                                             |
| Related      | [03-system-architecture](03-system-architecture.md) · [11-database-schema](11-database-schema.md) · [12-api-specification](12-api-specification.md) · [13-ui-pages](13-ui-pages.md) · [16-validation-framework](16-validation-framework.md) · [19-astrocode-compliance](19-astrocode-compliance.md) |

---

## Purpose

This document specifies the MIZAN Digital Twin — a data-driven virtual representation of the Azraq Basin (extensible to all of Jordan) that fuses the latest Earth Observation indicators, risk scores, and an interactive scenario engine into a single 3D geospatial experience. The twin is not a physics-based groundwater model; it is a **transparent, EO-grounded scenario calculator** that lets users explore "what if" questions about irrigated agriculture, rainfall deficit, and water-management policy, and immediately see the projected effect on the estimated water balance and groundwater-stress index — with explicit uncertainty bands and confidence labels at every step.

**Deliverables mapping:** Functional Prototype · Results Visualization · Impact Statement

---

## 1. Concept & Scope

### 1.1 What the Digital Twin Is

The MIZAN Digital Twin is a **data-linked, interactive 3D visualization and scenario workspace** for the Azraq Basin (Phase 1). It consists of three tightly coupled layers:

1. **Current-State Layer** — The twin's resting state reflects the most recently computed indicator values and risk scores pulled from the `indicator_values` and `risk_scores` tables. The 3D terrain, irrigated-area polygons, vegetation, and oasis extent are all driven by real data.

2. **Scenario Engine** — Users adjust a set of input parameters (see §3). For each parameter combination the engine applies the transparent water-balance equations (see §4) to produce projected outputs: crop water demand, estimated `water_balance_mcm`, and a projected `gw_stress_index` trajectory over a configurable horizon (1–10 years). Every output carries an uncertainty band and a `confidence` label.

3. **3D Visual Layer** — deck.gl layers over MapLibre GL JS render SRTM terrain, irrigated-area polygons, oasis extent, stress heatmap, and time-animation frames. Scenario A/B comparison mode splits the viewport.

### 1.2 What the Digital Twin Is NOT

> **DISCLAIMER (displayed prominently in the UI, non-removable):**
>
> "MIZAN Digital Twin scenarios are **indicative simulations, not predictions** of the actual groundwater table, aquifer pressure, or future hydrogeological state. Outputs are derived from EO proxies and simplified water-balance equations; they are not the product of a calibrated groundwater flow model. No scenario output should be used as the sole basis for legal, regulatory, or engineering decisions. All numbers are estimates with explicit uncertainty; see the Validation Envelope for each metric."

This disclaimer appears:
- As a persistent banner at the top of the `/twin` page.
- In the header of every exported scenario report.
- As an overlay on every scenario chart.
- Cited in the auto-generated scenario narrative (§8.3).

### 1.3 Geographic Scope

| Phase | Coverage | Notes |
|-------|----------|-------|
| 1 | Azraq Basin (~12,700 km²) | Primary demo basin |
| 2 (planned) | Full Jordan national | Requires regional indicator coverage |

The basin boundary GeoJSON is stored in Supabase Storage and referenced by the `map_layers` table (`layer_code = 'azraq_boundary'`).

### 1.4 Temporal Scope

- **Historical baseline:** 2015–2024 (10-year window of stored indicators).
- **Scenario horizon:** 1, 3, 5, or 10 years from a user-selected reference year.
- **Reference year default:** Most recent completed hydrological year (October–September) with full indicator coverage.

---

## 2. Twin State Assembly

### 2.1 Data Sources for Current State

The twin's current state is assembled at page load by the frontend via TanStack Query from two primary endpoints:

```
GET /rest/v1/indicator_values
  ?region_id=eq.{azraq_region_id}
  &date=eq.{latest_date}
  &select=indicator_code,value,unit,date,confidence_score_id

GET /rest/v1/risk_scores
  ?region_id=eq.{azraq_region_id}
  &date=eq.{latest_date}
  &select=gw_stress_index,gw_stress_class,sub_index_abstraction,
          sub_index_recharge,sub_index_veg_water,
          sub_index_surface_water,sub_index_storage,confidence_score_id
```

Each result is joined with `confidence_scores` and `provenance` to populate ValidationEnvelope metadata for every displayed metric.

### 2.2 Indicator Codes Consumed by the Twin

| Category | Indicator Code(s) | Role in Twin |
|----------|--------------------|--------------|
| Vegetation | `ndvi`, `ndvi_anomaly`, `evi` | Vegetation health; A/B comparison |
| Surface water | `ndwi`, `surface_water_extent_km2` | Oasis extent layer |
| Soil moisture | `s1_rvi`, `soil_moisture_proxy` | Recharge proxy input |
| Precipitation | `precip_mm`, `spi_3`, `spi_12` | Recharge calculation |
| ET | `et0_pm_mm`, `etc_mm` | Crop water demand |
| Agriculture | `irrigated_area_ha`, `crop_class`, `agri_expansion_pct` | Abstraction estimate |
| Water balance | `recharge_proxy_mm`, `abstraction_estimate_mcm`, `water_balance_mcm` | Balance output |
| Risk | `gw_stress_index`, `gw_stress_class` | Stress heatmap |

### 2.3 State Object Schema (TypeScript)

```typescript
// Assembled from Supabase; never fabricated by frontend
interface TwinCurrentState {
  regionId: string;           // azraq region UUID
  referenceDate: string;      // ISO 8601 date of latest indicators
  indicators: Record<string, IndicatorValue>;
  riskScore: RiskScore;
  layerUrls: {
    irrigatedArea:  string;   // MVT tile URL from map_layers
    oasisExtent:    string;
    stressHeatmap:  string;
    srtmTerrain:    string;
  };
}

interface IndicatorValue {
  code:        string;
  value:       number;
  unit:        string;
  date:        string;
  confidence:  ConfidenceLevel;   // 'High' | 'Medium' | 'Low'
  provenance:  ProvenanceRef;
}

interface RiskScore {
  gwStressIndex:         number;   // 0–100
  gwStressClass:         'Low' | 'Moderate' | 'High' | 'Severe';
  subIndexAbstraction:   number;   // 0–100
  subIndexRecharge:      number;
  subIndexVegWater:      number;
  subIndexSurfaceWater:  number;
  subIndexStorage:       number;
  confidence:            ConfidenceLevel;
  confidenceScore:       number;   // 0.0–1.0
  provenance:            ProvenanceRef;
}

type ConfidenceLevel = 'High' | 'Medium' | 'Low';

interface ProvenanceRef {
  source:      string;
  date:        string;
  methodology: string;
  explanation: string;
}
```

---

## 3. Scenario Engine — Parameters

### 3.1 User-Adjustable Input Parameters

The scenario engine exposes the following parameters via the Scenario Control Panel (see §7.2). All parameters have default values from the current-state twin data; users adjust sliders and dropdowns to explore deviations.

| Parameter ID | Display Name (EN) | Display Name (AR) | Type | Range / Options | Default |
|---|---|---|---|---|---|
| `delta_irrigated_pct` | Irrigated area change | تغيير المساحة المروية | Slider | −50% to +100% | 0% |
| `crop_mix` | Crop mix scenario | مزيج المحاصيل | Select | Current, Vegetable-heavy, Cereal-heavy, Forage-heavy, Custom | Current |
| `irrigation_efficiency` | Irrigation efficiency | كفاءة الري | Slider | 40%–95% | Derived from current `irrigated_area_ha` / `etc_mm` |
| `rainfall_scenario` | Rainfall scenario | سيناريو هطول الأمطار | Select | Historical mean, Wet +20%, Dry −20%, Drought −40%, Custom | Historical mean |
| `abstraction_cap_mcm` | Annual abstraction cap (MCM) | حد الاستخراج السنوي | Slider | 0–200 MCM | Uncapped |
| `policy_intervention` | Policy intervention | التدخل السياسي | Multi-select | None, Irrigation ban on new wells, 20% quota cut, Drip-only mandate, Aquifer recharge program | None |
| `scenario_horizon_yr` | Projection horizon | أفق الإسقاط | Select | 1, 3, 5, 10 years | 5 |
| `reference_year` | Reference year | سنة الإسناد | Select | 2015–2024 | Latest complete year |
| `monte_carlo_runs` | Uncertainty runs | تشغيلات عدم اليقين | Select | 100, 500, 1000 | 500 |

### 3.2 Crop Mix Kc Values (Reference Table, Stored in DB)

The `crop_class` lookup table in Supabase stores FAO-56 crop coefficients used by the scenario engine:

```json
[
  { "crop":  "Tomato",         "kc_ini": 0.60, "kc_mid": 1.15, "kc_end": 0.70, "fraction_default": 0.30 },
  { "crop":  "Potato",         "kc_ini": 0.50, "kc_mid": 1.15, "kc_end": 0.75, "fraction_default": 0.15 },
  { "crop":  "Wheat",          "kc_ini": 0.30, "kc_mid": 1.15, "kc_end": 0.25, "fraction_default": 0.20 },
  { "crop":  "Forage (alfalfa)","kc_ini": 0.40, "kc_mid": 0.95, "kc_end": 0.90, "fraction_default": 0.20 },
  { "crop":  "Olive",          "kc_ini": 0.65, "kc_mid": 0.70, "kc_end": 0.70, "fraction_default": 0.10 },
  { "crop":  "Cucurbits",      "kc_ini": 0.50, "kc_mid": 1.00, "kc_end": 0.75, "fraction_default": 0.05 }
]
```

Weighted average `Kc` for a given crop mix is: `Kc_avg = Σ(fraction_i · kc_mid_i)`.

---

## 4. Transparent Equations

All computations are performed server-side in the `scenario-run` Edge Function. These equations are reproduced verbatim in the "Behind the Numbers" panel of the UI so users can audit every calculation.

### 4.1 Reference Evapotranspiration

The Penman-Monteith ET₀ (FAO-56) is stored as indicator `et0_pm_mm` from Google Earth Engine. The scenario engine uses the stored historical mean or a user-specified multiplier:

```
ET₀_scenario = ET₀_historical_mean × rainfall_scenario_et_multiplier
```

`rainfall_scenario_et_multiplier` values (stored in `scenarios` metadata):

| Rainfall Scenario | Precip multiplier | ET₀ multiplier |
|---|---|---|
| Historical mean | 1.00 | 1.00 |
| Wet +20% | 1.20 | 0.95 |
| Dry −20% | 0.80 | 1.05 |
| Drought −40% | 0.60 | 1.10 |

### 4.2 Crop Water Demand (ETc)

Per FAO-56, with a weighted average crop coefficient for the scenario crop mix:

```
ETc_crop_i  =  Kc_i  ×  ET₀_scenario          [mm/season]
ETc_basin   =  Σ_i [ irrigated_area_crop_i  ×  ETc_crop_i ]   [mm·ha → m³ with ×10]
```

Where `irrigated_area_crop_i = (fraction_i × irrigated_area_ha × (1 + delta_irrigated_pct/100))`.

### 4.3 Effective Rainfall

```
eff_rain_mm  =  min(precip_mm_scenario, ETc_basin_mm)  ×  0.75
```

(The 0.75 is a conservative FAO runoff factor for arid soils. Stored as `eff_rain_coefficient` in scenario metadata; can be overridden by analysts.)

### 4.4 Abstraction Estimate

```
abstraction_estimate_MCM  =
    Σ_crop [ irrigated_area_crop_ha  ×  (ETc_crop_mm − eff_rain_mm)  /  irrigation_efficiency ]
    ×  0.01   [unit conversion: ha·mm → MCM, i.e., ×10/1,000,000 = ×0.00001]
```

This is then clamped if `abstraction_cap_mcm` is set:

```
abstraction_applied_MCM = min(abstraction_estimate_MCM, abstraction_cap_mcm)
```

### 4.5 Recharge Proxy

```
recharge_proxy_mm  =  α × max(0, precip_mm_scenario − P_threshold)
recharge_proxy_MCM =  recharge_proxy_mm × basin_area_km² × 1000 / 1,000,000
```

Parameters (stored in `scenarios.metadata`):
- `α` (recharge coefficient) = 0.12 (literature range 0.08–0.20 for basalt/alluvial mix in Azraq; source: BGR/MWI reports).
- `P_threshold` = 75 mm/yr (precipitation below which negligible recharge occurs).
- `basin_area_km²` = 12,700 for Azraq.

Policy intervention `Aquifer recharge program` adds a fixed `recharge_augmentation_MCM` parameter (user-defined, default 5 MCM/yr).

### 4.6 Natural Discharge

```
natural_discharge_MCM  =  base_flow_MCM × discharge_scenario_factor
```

`base_flow_MCM` = 8 MCM/yr (literature estimate for Azraq springs/base flow; MIZAN treats this as an external reference, not an observation). `discharge_scenario_factor` = 0.5 under drought, 1.0 otherwise.

### 4.7 Water Balance

```
water_balance_MCM  =  recharge_proxy_MCM
                    − abstraction_applied_MCM
                    − natural_discharge_MCM
                    + recharge_augmentation_MCM   [if policy active]
```

### 4.8 GW Stress Index Projection

The projected `gw_stress_index` for year `t` applies the same sub-index weighting as the real-time risk module (see [08-risk-scoring](08-risk-scoring.md)):

```
gw_stress_index(t) = 0.30 × abstraction_sub(t)
                   + 0.25 × recharge_sub(t)
                   + 0.20 × veg_water_sub(t)
                   + 0.15 × surface_water_sub(t)
                   + 0.10 × storage_sub(t)
```

Sub-indices for year `t` are derived by propagating the water-balance deficit/surplus forward:

```
storage_deficit_cumulative(t) = storage_deficit_cumulative(t-1) − water_balance_MCM(t)
storage_sub(t) = clamp( storage_deficit_cumulative(t) / storage_normalizer, 0, 100 )
```

`storage_normalizer` = 500 MCM (literature-based estimate of exploitable storage; stored in scenario metadata with source citation). Other sub-indices are recalculated from scenario-driven indicator values.

### 4.9 Uncertainty Quantification

Monte Carlo sampling is used to propagate parameter uncertainty:

- `α` drawn from `Uniform(0.08, 0.20)`
- `ET₀` drawn from `Normal(ET₀_mean, ET₀_std)` (std from historical record)
- `irrigation_efficiency` drawn from `Uniform(efficiency − 0.05, efficiency + 0.05)` (±5%)
- `precip_mm_scenario` drawn from the fitted historical precipitation distribution for the selected scenario band

For each of `N` Monte Carlo runs the scalar equations in §4.2–4.8 are evaluated. Outputs reported as `[p10, p50, p90]` (10th, 50th, 90th percentiles).

---

## 5. Scenario Data Storage

### 5.1 `scenarios` Table

```sql
-- Stored scenario definitions (see 11-database-schema.md for full DDL)
CREATE TABLE scenarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id       UUID REFERENCES regions(id),
  created_by      UUID REFERENCES profiles(id),
  name            TEXT NOT NULL,
  description     TEXT,
  reference_year  INT  NOT NULL,
  horizon_years   INT  NOT NULL DEFAULT 5,
  parameters      JSONB NOT NULL,   -- all §3.1 parameters
  metadata        JSONB,            -- α, P_threshold, Kc table snapshot, etc.
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

Example `parameters` JSON for a stored scenario:

```json
{
  "delta_irrigated_pct":    25,
  "crop_mix":               "Vegetable-heavy",
  "irrigation_efficiency":  0.65,
  "rainfall_scenario":      "Dry -20%",
  "abstraction_cap_mcm":    null,
  "policy_intervention":    ["Drip-only mandate"],
  "scenario_horizon_yr":    10,
  "monte_carlo_runs":        500
}
```

### 5.2 `scenario_results` Table

```sql
CREATE TABLE scenario_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  year_offset     INT  NOT NULL,   -- 0 = reference year, 1 = year 1, etc.
  calendar_year   INT  NOT NULL,
  -- Outputs
  etc_mm          NUMERIC,
  crop_water_demand_mcm    NUMERIC,
  abstraction_estimate_mcm NUMERIC,
  recharge_proxy_mcm       NUMERIC,
  water_balance_mcm        NUMERIC,
  gw_stress_index          NUMERIC,
  gw_stress_class          TEXT,
  -- Uncertainty bands
  p10_water_balance_mcm    NUMERIC,
  p90_water_balance_mcm    NUMERIC,
  p10_gw_stress_index      NUMERIC,
  p90_gw_stress_index      NUMERIC,
  -- Metadata
  confidence_level         TEXT,
  computed_at              TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. API: `scenario-run` Edge Function

See [12-api-specification](12-api-specification.md) §scenario-run for full OpenAPI definition. Summary:

### Request

```http
POST /functions/v1/scenario-run
Authorization: Bearer <supabase_anon_or_user_jwt>
Content-Type: application/json
```

```json
{
  "region_id":            "uuid-azraq",
  "reference_year":       2023,
  "horizon_years":        5,
  "parameters": {
    "delta_irrigated_pct":    25,
    "crop_mix":               "Vegetable-heavy",
    "irrigation_efficiency":  0.65,
    "rainfall_scenario":      "Dry -20%",
    "abstraction_cap_mcm":    null,
    "policy_intervention":    ["Drip-only mandate"],
    "monte_carlo_runs":        500
  },
  "save":  true,
  "name":  "High-Expansion Dry Scenario"
}
```

### Response

```json
{
  "scenario_id": "uuid-scenario",
  "status":      "completed",
  "results": [
    {
      "year_offset":                0,
      "calendar_year":              2023,
      "crop_water_demand_mcm":     68.4,
      "abstraction_estimate_mcm":  74.2,
      "recharge_proxy_mcm":        14.1,
      "water_balance_mcm":        -68.6,
      "gw_stress_index":            81.3,
      "gw_stress_class":           "Severe",
      "p10_water_balance_mcm":    -82.1,
      "p90_water_balance_mcm":    -55.3,
      "p10_gw_stress_index":       74.0,
      "p90_gw_stress_index":       88.6,
      "confidence_level":          "Medium"
    }
  ],
  "equations_log": "...",
  "disclaimer":    "Indicative simulation only — see §10-digital-twin.md §1.2"
}
```

The `equations_log` field contains a step-by-step substitution trace (all variable values with units) that is rendered in the "Behind the Numbers" panel.

### Error Codes

| Code | Meaning |
|------|---------|
| 400  | Invalid parameters (e.g., efficiency > 1.0) |
| 422  | Insufficient base indicator data for reference year |
| 429  | Rate limit exceeded (scenario compute is CPU-intensive) |
| 503  | Earth Engine backend unavailable |

---

## 7. Page UX — `/twin`

### 7.1 Page Purpose & Users

| Attribute | Value |
|-----------|-------|
| Route | `/twin` |
| Purpose | Interactive 3D scenario workspace for exploring water-balance futures |
| Primary users | Analysts (role: `analyst`), Policy staff (role: `admin`), Judges evaluating the platform (role: `judge`) |
| Secondary users | Viewers wanting to understand scenario concepts (role: `viewer`, read-only, cannot save) |
| Deliverables demonstrated | Functional Prototype, Results Visualization, Impact Statement |

### 7.2 Wireframe Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MIZAN nav bar (logo · page links · lang toggle EN/AR · user avatar)         │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⚠ DISCLAIMER BANNER (always visible, yellow bg, non-dismissable)            │
│  "Scenarios are indicative simulations — not predictions of the actual       │
│   groundwater table. See Validation Envelope for confidence and caveats."    │
├──────────────────────┬───────────────────────────────────────────────────────┤
│  SCENARIO CONTROL    │   3D MAP VIEWPORT (deck.gl over MapLibre)             │
│  PANEL (left, 320px) │                                                       │
│                      │   [Azraq Basin 3D terrain]                            │
│  ┌──────────────┐    │   [SRTM elevation exaggerated ×3]                     │
│  │ Scenario A   │    │   [Irrigated area polygons — color = crop class]      │
│  │ (current)    │    │   [Oasis extent — blue fill]                          │
│  └──────────────┘    │   [Stress heatmap — Low=green→Severe=red]             │
│  ┌──────────────┐    │                                                       │
│  │ Scenario B   │    │   ┌────────────────────────────────────────────┐      │
│  │ (compare)    │    │   │ LAYER CONTROL (top-right collapsible panel) │      │
│  └──────────────┘    │   │ ☑ Irrigated Area  ☑ Oasis  ☑ Stress       │      │
│  [A/B Toggle]        │   │ ☐ NDVI Anomaly    ☐ Precip Anomaly        │      │
│                      │   └────────────────────────────────────────────┘      │
│  ─── Parameters ───  │                                                       │
│  Irrigated area Δ    │   ┌────────────────────────────────────────────┐      │
│  [slider ±%]         │   │ TIME SLIDER  ◄ ▶  2023 ──────────── 2033  │      │
│                      │   └────────────────────────────────────────────┘      │
│  Crop mix            │                                                       │
│  [dropdown]          │   [Basin boundary highlight on hover]                 │
│                      │   [Click cell → mini ValidationEnvelope popup]        │
│  Irrigation eff.     │                                                       │
│  [slider %]          ├───────────────────────────────────────────────────────┤
│                      │   OUTPUT PANEL (bottom, collapsible, 280px)           │
│  Rainfall scenario   │                                                       │
│  [dropdown]          │  ┌────────────────┐  ┌────────────────┐  ┌─────────┐ │
│                      │  │ WATER BALANCE  │  │ GW STRESS TRAJ │  │CROP WTR │ │
│  Abstraction cap     │  │ MCM / yr       │  │ INDEX 0–100    │  │DEMAND   │ │
│  [slider MCM]        │  │ [area chart]   │  │ [line chart +  │  │MCM/yr   │ │
│                      │  │ shaded p10-p90]│  │  uncertainty   │  │[bar]    │ │
│  Policy              │  │                │  │  band]         │  │         │ │
│  [multi-select]      │  │ ─ A: −68 MCM ─ │  │                │  │         │ │
│                      │  │ ─ B: −42 MCM ─ │  │ ─ A: Severe ─  │  │         │ │
│  Horizon: [5 yr ▾]   │  └────────────────┘  └────────────────┘  └─────────┘ │
│                      │  [ValidationEnvelope badge on each chart → popover]   │
│  [▶ Run Scenario]    │                                                       │
│  [💾 Save]           ├───────────────────────────────────────────────────────┤
│  [📤 Export PDF]     │  EQUATIONS PANEL ("Behind the Numbers") — collapsible │
│                      │  Shows step-by-step substitution log from API response│
│  Saved Scenarios:    │  ETc = Kc × ET₀ = 0.92 × 5.1 mm/day × 120 days …    │
│  [scenario list]     │  abstraction = 74.2 MCM  recharge = 14.1 MCM         │
└──────────────────────┴───────────────────────────────────────────────────────┘
```

### 7.3 Interaction Flows

#### Flow 1 — Run Scenario

1. User opens `/twin`. Page loads Current State (TanStack Query, stale-while-revalidate 15 min).
2. Default Scenario A is pre-populated with current indicator values (no change = baseline).
3. User adjusts sliders/dropdowns in Scenario A control panel. Parameter values are reflected in real time in the control panel summary but no computation fires yet.
4. User clicks **Run Scenario**. Frontend posts to `scenario-run` Edge Function (§6).
5. Loading state: spinner overlay on Output Panel; map layers pulse with shimmer.
6. On success: charts update; 3D map animates time-slider from reference year to `reference_year + horizon_years`, with the stress heatmap recoloring each year.
7. User optionally adds **Scenario B** (same flow), enabling side-by-side comparison. The 3D viewport splits horizontally; a diff mode shows delta-heatmap (B minus A).
8. User clicks **Save** (analyst/admin only) → scenario written to `scenarios` + `scenario_results`.

#### Flow 2 — Time Animation

1. User clicks ▶ on the time slider.
2. Each frame advances by 1 year; map layers re-render with scenario-year data from cached `scenario_results`.
3. Output charts highlight the current year with a vertical crosshair.
4. Animation pauses if a ValidationEnvelope popover is open.

#### Flow 3 — ValidationEnvelope on Map

1. User clicks any grid cell in the stress heatmap.
2. A popover appears:
   - **Source:** Google Earth Engine / MIZAN scenario engine
   - **Date:** Reference year + year offset
   - **Methodology:** Link to §4 equations
   - **Confidence:** Medium/Low (scenario outputs are always ≤ Medium)
   - **Explanation:** "This stress estimate is derived from the scenario water-balance calculation, not from observed groundwater data."
3. User can click "Full Provenance" to navigate to `/validation?layer=gw_stress_index&scenario={id}`.

#### Flow 4 — Export

1. User clicks **Export PDF**. Frontend calls `report-generate` Edge Function with `report_type = 'scenario'` and `scenario_id`.
2. Progress toast displayed. On completion, browser downloads the PDF.
3. PDF includes mandatory disclaimer, all charts with uncertainty bands, and a full provenance appendix.

### 7.4 States

| State | Description |
|-------|-------------|
| Loading (initial) | Skeleton shimmer on 3D map + output panel; spinner in scenario control |
| Loaded (baseline) | 3D map shows current state; output panel shows real-time indicators, not scenario |
| Running | Spinner on Run button; map shimmer; charts show "Computing…" |
| Results | Full outputs shown; time slider enabled; export available |
| Error (compute fail) | Toast "Scenario computation failed — {reason}"; retry button |
| Error (no data) | "Insufficient indicator data for {reference_year}" with suggestion to pick earlier year |
| Saving | Save button disabled; "Saving…" label |
| Comparison mode | Viewport split; diff heatmap layer active |
| Offline (demo) | Reads from cached demo scenario (Azraq reference period 2023); shows "(Demo data)" badge |

---

## 8. 3D Visual Representation

### 8.1 deck.gl Layer Stack

All deck.gl layers are rendered inside a `DeckGL` component mounted on the same `MapLibre` canvas. Layer order (bottom to top):

```
1. MapLibre basemap (MapTiler Satellite/Terrain style)
2. TerrainLayer        — SRTM DEM, exaggeration ×3
3. GeoJsonLayer        — Azraq Basin boundary (line, weight 2, color cobalt)
4. MVTLayer            — Irrigated area polygons (choropleth by crop_class)
5. GeoJsonLayer        — Oasis extent polygon (blue fill, 60% opacity)
6. HeatmapLayer        — GW stress heatmap (Low=green, Moderate=yellow, High=orange, Severe=red)
7. GeoJsonLayer        — Sub-basin labels (TextLayer)
8. ScatterplotLayer    — Monitoring point markers (if any reference points exist)
```

For Scenario A/B split view, two full layer stacks are rendered side-by-side using two `DeckGL` instances sharing the same `MapLibre` base but with independent data props.

### 8.2 Terrain Specification

```typescript
const terrainLayer = new TerrainLayer({
  elevationDecoder: {
    rScaler: 256,
    gScaler: 1,
    bScaler: 1/256,
    offset:  -32768
  },
  elevationData:  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  texture:        maptilerSatelliteUrl,
  wireframe:      false,
  material: {
    ambient:   0.35,
    diffuse:   0.6,
    shininess: 32
  }
});
```

Exaggeration is set via the `TerrainLayer` `maxPitch` and a custom `zScale` wrapper. At the default Azraq view (zoom 9, pitch 45°) the Jebel Druze and Azraq depression topographic contrast is visible.

### 8.3 Animated Layer Update

```typescript
// Year animation driver
function animateYears(scenarioResults: ScenarioResult[], fps = 1) {
  let frame = 0;
  const interval = setInterval(() => {
    setActiveYear(scenarioResults[frame].calendar_year);
    frame++;
    if (frame >= scenarioResults.length) clearInterval(interval);
  }, 1000 / fps);
  return interval;
}
```

Each frame, the `HeatmapLayer` and `MVTLayer` data props are swapped to the year-specific GeoJSON derived from `scenario_results`. Transitions use deck.gl's built-in `transitions` prop with `{ getWeight: { duration: 800 } }`.

---

## 9. ValidationEnvelope Integration

Every metric displayed in the Digital Twin — whether drawn from current-state indicators or from scenario outputs — carries a `ValidationEnvelope` badge (see [13-ui-pages](13-ui-pages.md) §3.3 for the full component spec).

### 9.1 Scenario-Specific Confidence Rules

Scenario outputs carry **automatically downgraded confidence**:

| Condition | Assigned Confidence |
|-----------|---------------------|
| Base indicator confidence High + horizon ≤ 3 yr | Medium |
| Base indicator confidence High + horizon > 3 yr | Low |
| Base indicator confidence Medium | Low |
| Base indicator confidence Low | Low (flagged as "Insufficient basis") |

This downgrade is applied by the `scenario-run` Edge Function and stored in `scenario_results.confidence_level`.

### 9.2 Mandatory Envelope Fields for Scenario Outputs

| Field | Value |
|-------|-------|
| Source | MIZAN scenario engine v0.1 |
| Date | Scenario run timestamp |
| Methodology | "Water-balance equations §4 of 10-digital-twin.md; EO proxy inputs from GEE" |
| Confidence | Per §9.1 rules |
| Explanation | "This is an indicative simulation output derived from simplified equations applied to EO proxies. It is not a calibrated groundwater model prediction." |

---

## 10. Scientific Integrity Statements

The following statements are surfaced in the UI and in all exported outputs:

1. **Non-observation statement:** "MIZAN does not observe groundwater levels, aquifer pressure, or pumping rates. All groundwater-related indicators are proxies estimated from satellite data."

2. **Non-prediction statement:** "Scenario trajectories are sensitivity analyses, not forecasts. The true future state depends on factors not captured in these equations."

3. **Equation transparency statement:** "All equations used in this scenario are documented in MIZAN specification 10-digital-twin.md §4 and reproduced in the 'Behind the Numbers' panel below."

4. **Uncertainty acknowledgement:** "All outputs are shown with p10–p90 uncertainty bands from Monte Carlo sampling. The central estimate (p50) should not be interpreted as a point prediction."

5. **Validation Envelope obligation:** "Every number in this view carries a Validation Envelope. Click the badge to inspect source, methodology, confidence, and explanation."

---

## 11. Deliverables Mapping

| AstroCode Deliverable | How the Digital Twin Demonstrates It |
|---|---|
| Functional Prototype | Interactive scenario engine that runs real calculations on stored EO data via `scenario-run` Edge Function |
| Data Explanation | "Behind the Numbers" panel shows all equation steps with real values; transparent parameter definitions |
| AI/Analytics Method | Monte Carlo uncertainty quantification; sub-index weighting; FAO-56 ET methods documented |
| Results Visualization | 3D deck.gl map, time animation, A/B comparison, uncertainty-band charts |
| Jordanian Use Case | Specifically parameterised for Azraq Basin; crop mixes and reference values from Jordanian agronomic literature |
| Impact Statement | Scenario outputs projected to 2033 show quantified risk trajectories for policy communications |

---

## 12. Accessibility & i18n

- All 3D map controls have ARIA labels.
- Sliders are `<input type="range">` with visible value labels and keyboard support.
- Color scales use both hue and lightness for colorblindness robustness; an accessible palette toggle (deuteranopia-safe) is available in Settings.
- All Arabic labels and the disclaimer banner render RTL via `dir="rtl"` on the parent container when language is AR.
- Time animation can be keyboard-driven (Space = play/pause, ArrowRight/Left = step).
- WCAG 2.1 AA: contrast ratio ≥ 4.5:1 for all text over map overlays (white text on darkened tile).

---

## 13. Performance Notes

- `scenario-run` runs server-side; frontend never performs Monte Carlo locally.
- Scenario results are cached in TanStack Query with key `['scenario', scenario_id]`; re-runs are only triggered on parameter change.
- deck.gl layers use WebGL2; graceful fallback to 2D MapLibre if WebGL2 unavailable.
- Terrain tiles are cached by the browser (MapTiler serves with long `Cache-Control`).
- MVT tiles for stress heatmap are pre-computed and served from Supabase Storage; not recomputed per scenario (scenario heatmaps use GeoJSON overlay instead).
- Maximum scenario horizon enforced at 10 years server-side to prevent excessive Monte Carlo compute time (> 30s timeout).

---

## 14. Related Documents

| Doc | Relationship |
|-----|-------------|
| [11-database-schema](11-database-schema.md) | `scenarios`, `scenario_results`, `indicator_values`, `risk_scores` table DDL |
| [12-api-specification](12-api-specification.md) | `scenario-run` Edge Function full OpenAPI spec |
| [08-risk-scoring](08-risk-scoring.md) | Sub-index weighting used in §4.8 |
| [09-confidence-engine](09-confidence-engine.md) | Confidence downgrade rules for scenario outputs |
| [16-validation-framework](16-validation-framework.md) | ValidationEnvelope component and provenance chain |
| [13-ui-pages](13-ui-pages.md) | App shell, nav, global components; `/twin` page listed |
| [19-astrocode-compliance](19-astrocode-compliance.md) | Deliverables-to-feature mapping |
