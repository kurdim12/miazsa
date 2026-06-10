# 16 — Validation Framework

| Field        | Value                                                                    |
|--------------|--------------------------------------------------------------------------|
| Document     | 16-validation-framework.md                                               |
| Project      | MIZAN — Earth Observation Environmental Intelligence for Jordan           |
| Version      | 0.1 (Draft)                                                              |
| Status       | Phase 1 — Specification                                                  |
| Last updated | 2026-06-10                                                               |
| Related      | [07-machine-learning](07-machine-learning.md) · [08-risk-scoring](08-risk-scoring.md) · [09-confidence-engine](09-confidence-engine.md) · [11-database-schema](11-database-schema.md) · [13-ui-pages](13-ui-pages.md) · [18-deployment](18-deployment.md) · [20-limitations](20-limitations.md) |

---

## Purpose

This document defines MIZAN's end-to-end validation framework. Its philosophy is **trust through
transparency**: every number that MIZAN displays must be traceable to a documented source, pass
defined quality checks at each layer of the pipeline, and carry an explicit statement of confidence,
methodology, and limitations. Validation is not a post-hoc audit step — it is a first-class
engineering and scientific obligation woven into every pipeline stage.

**Deliverables mapping:** Data Explanation · AI/Analytics Method · Functional Prototype ·
Jordanian Use Case

---

## 1. Philosophy: Trust Through Transparency

### 1.1 Four-Level Validation Hierarchy

MIZAN's validation obligation operates at four nested levels:

```
┌──────────────────────────────────────────────────────────────────┐
│  PRODUCT LEVEL — Risk scoring, confidence, AI output, UI display  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  MODEL LEVEL — ML accuracy, calibration, drift, SHAP       │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  METHOD LEVEL — EO algorithm cross-checks, physics   │  │  │
│  │  │  ┌────────────────────────────────────────────────┐  │  │  │
│  │  │  │  DATA LEVEL — schema, range, freshness, QA flags│  │  │  │
│  │  │  └────────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

Each level inherits the guarantees of the levels below it. A model output that fails data-level
validation is never promoted to the risk score. A UI metric without a validated confidence record
is never displayed without a visible "Low Confidence / Insufficient Data" banner.

### 1.2 Non-Negotiable Rules

1. **No fabrication** — Every value in the database traces to a GEE computation, a stored dataset,
   or a model output applied to real input data. No value is hard-coded, estimated by eye, or
   invented for display purposes.
2. **No silent failure** — A failed validation check must produce a `validation_records` entry with
   `status = 'failed'`. Data gaps produce NULL values with a provenance note — never zero or
   placeholder values.
3. **Full traceability** — Every `indicator_values` row carries a `provenance_id` FK to the
   `provenance` table, which in turn records the GEE collection ID, date range, algorithm version,
   and run ID.
4. **Envelope on every metric** — The five-field Validation Envelope (Source, Date, Methodology,
   Confidence, Explanation) is populated for every indicator before it is eligible for display.
5. **Scientific stance is preserved** — Validation documentation must reaffirm that MIZAN
   estimates stress *indicators* — not direct groundwater measurements — at every validation output
   surface.

---

## 2. Data-Level Validation

### 2.1 Schema and Type Checks

Every record ingested into `indicator_values` from the EE Worker must pass a schema validation
layer before `INSERT`. The checks are implemented as:

- **PostgreSQL constraints** (NOT NULL, CHECK on value ranges, FK integrity) — hard enforcement;
  violations cause the insert transaction to abort.
- **Deno/TypeScript validation** in the `ee-compute` Edge Function — soft pre-flight checks
  performed before any write attempt, with structured error logging to `audit_log`.

```sql
-- Illustrative: range check constraint on indicator_values
ALTER TABLE indicator_values
  ADD CONSTRAINT chk_ndvi_range
    CHECK (
      indicator_code != 'NDVI'
      OR (value BETWEEN -1.0 AND 1.0)
    );

ALTER TABLE indicator_values
  ADD CONSTRAINT chk_confidence_range
    CHECK (confidence_score BETWEEN 0.0 AND 1.0);

ALTER TABLE indicator_values
  ADD CONSTRAINT chk_date_not_future
    CHECK (observation_date <= CURRENT_DATE);
```

### 2.2 Range and Domain Checks

Each indicator has a documented valid physical domain. Out-of-range values fail data-level
validation and are quarantined to `indicator_values_quarantine` (same schema, extra `quarantine_reason`
column) rather than the live table.

| Indicator | Valid Range | Notes |
|-----------|-------------|-------|
| NDVI | −1.0 – 1.0 | Theoretical; warn if < −0.1 or > 0.9 for vegetation |
| NDWI / MNDWI | −1.0 – 1.0 | Warn if > 0.5 for non-water pixels |
| SPI | −4.0 – +4.0 | Gaussian standardised; warn beyond ±3.5 |
| ET₀ (mm/day) | 0.0 – 15.0 | FAO-56; >12 triggers review in arid months |
| Soil moisture proxy | 0.0 – 1.0 | Normalised SAR backscatter derivative |
| GRACE TWS anomaly (cm EWH) | −50 – +50 | Jordan/Azraq regional mascon |
| GW Stress Index | 0.0 – 100.0 | Composite; warn if rate-of-change > 20/month |
| Irrigated area (ha) | 0 – 500,000 | For Azraq Basin AOI; flag if >400k |
| Confidence score | 0.0 – 1.0 | All metrics |

### 2.3 Freshness Checks

Each indicator has a `max_staleness_days` property stored in the `indicators` table. The
`confidence` Edge Function subtracts staleness penalty from the freshness factor when data is older
than expected.

```sql
-- Illustrative: indicators table freshness column
ALTER TABLE indicators
  ADD COLUMN max_staleness_days   INTEGER NOT NULL DEFAULT 45,
  ADD COLUMN target_cadence_days  INTEGER NOT NULL DEFAULT 30;

-- View: stale indicators
CREATE OR REPLACE VIEW stale_indicators AS
SELECT
  i.code,
  i.name,
  MAX(iv.observation_date)          AS latest_observation,
  CURRENT_DATE - MAX(iv.observation_date) AS days_stale,
  i.max_staleness_days
FROM indicators i
LEFT JOIN indicator_values iv ON iv.indicator_id = i.id
GROUP BY i.id, i.code, i.name, i.max_staleness_days
HAVING CURRENT_DATE - MAX(iv.observation_date) > i.max_staleness_days
    OR MAX(iv.observation_date) IS NULL;
```

The `alerts` Edge Function queries `stale_indicators` at each scheduled run and emits a
`DATA_STALENESS` alert if any primary indicator is stale, so the UI can display a warning banner.

### 2.4 Spatial Coverage Checks

Before computing a basin-level statistic, the EE Worker calculates the percentage of valid
(non-masked, non-cloud) pixels within the AOI geometry. A minimum coverage threshold must be met:

| Dataset | Min Valid Pixel Coverage | Action Below Threshold |
|---------|--------------------------|------------------------|
| S2 NDVI (Azraq monthly) | 60 % | Quarantine; flag `low_coverage`; degrade spatial_coverage confidence factor |
| S1 SAR (soil moisture proxy) | 80 % | Record with `low_coverage` note; no quarantine (SAR cloud-free) |
| CHIRPS monthly | 95 % | CHIRPS is gap-filled; flag only if > 5 % missing |
| GRACE TWS | N/A (coarse grid) | Use nearest mascon; record resolution_note |
| JRC GSW | 70 % | Degrade confidence; flag |

The spatial coverage percentage is stored in `indicator_values.spatial_coverage_pct` and feeds
directly into the confidence engine's `spatial_coverage` factor (see doc 09).

### 2.5 Dataset QA Flags

MIZAN respects source-level QA flags embedded in GEE collections:

- **S2 `QA60` band**: pixels flagged as opaque cloud or cirrus are masked before any index
  computation. The cloud-masked pixel count is stored.
- **S1 `angle` band**: pixels with incidence angle outside 30–45° are excluded from soil moisture
  proxy derivation to avoid geometric distortion artefacts.
- **CHIRPS**: the embedded quality code (`qflag`) is checked; only `qflag = 1` (good) is used for
  primary computation; `qflag = 0` (estimated) is used with a confidence penalty.
- **GRACE V03 MASCON**: the uncertainty field (`uncertainty`) is propagated into the confidence
  calculation.

### 2.6 Input Anomaly Screening

Before model inference, each feature vector is passed through a lightweight pre-trained
`IsolationForest` boundary model that flags inputs outside the training distribution. This
constitutes the `iforest_anomaly` model used in both standalone anomaly detection and as an
upstream guard for the XGBoost irrigation detector.

```python
# Illustrative: Python pseudo-code in EE Worker
from sklearn.ensemble import IsolationForest
import numpy as np

def screen_input_anomalies(feature_matrix: np.ndarray, iforest_model) -> np.ndarray:
    """
    Returns anomaly_score in [0, 1]; score > 0.6 triggers quarantine flag.
    IsolationForest.decision_function returns negative = anomalous.
    Normalise to [0,1] where 1 = most anomalous.
    """
    raw_scores = iforest_model.decision_function(feature_matrix)
    # Invert and rescale to [0,1]
    anomaly_scores = 1.0 - (raw_scores - raw_scores.min()) / (
        raw_scores.max() - raw_scores.min() + 1e-9
    )
    return anomaly_scores
```

Inputs with `anomaly_score > 0.6` are logged to `validation_records` with
`validation_type = 'input_anomaly'` and trigger a confidence penalty on downstream metrics.

---

## 3. Method-Level Validation

### 3.1 Philosophy

Method validation asks: *Is the EO algorithm doing what it claims, independently of the model on
top of it?* For MIZAN this means cross-checking computed indices and retrievals against independent
EO-derived sources before model inputs are accepted.

### 3.2 JRC Global Surface Water Cross-Check

The Azraq Oasis surface-water extent derived from MIZAN's MNDWI threshold method is cross-validated
against the JRC Global Surface Water `occurrence` and `seasonality` layers.

| Check | Method | Target Agreement |
|-------|--------|-----------------|
| Open-water area (km²) | MNDWI-derived vs JRC annual-occurrence > 75 % | Area difference < 15 % |
| Seasonal pattern | MIZAN monthly inundation vs JRC `seasonality` class | Spearman ρ ≥ 0.80 |
| Trend direction | 5-year trend sign | Must agree (both declining or both stable/increasing) |

Cross-check results are written to `validation_records` with
`validation_type = 'jrc_surface_water_xcheck'` on each annual run.

### 3.3 MODIS NDVI Cross-Check

MIZAN's primary vegetation signal comes from Sentinel-2 (10 m). MODIS MOD13Q1/MYD13Q1 (250 m, 16-day)
provides an independent cross-check at coarser resolution.

```python
# Illustrative: GEE Python — Pearson correlation S2 vs MODIS NDVI over Azraq
import ee

def cross_validate_ndvi(azraq_geom, year: int) -> dict:
    s2_ndvi = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(azraq_geom)
        .filterDate(f"{year}-01-01", f"{year}-12-31")
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .map(lambda img: img.normalizedDifference(["B8", "B4"]).rename("NDVI"))
        .median()
    )
    modis_ndvi = (
        ee.ImageCollection("MODIS/061/MOD13Q1")
        .filterBounds(azraq_geom)
        .filterDate(f"{year}-01-01", f"{year}-12-31")
        .select("NDVI")
        .median()
        .multiply(0.0001)  # scale factor
    )
    # Resample S2 to MODIS resolution for pixel-wise correlation
    s2_resampled = s2_ndvi.reproject(crs="EPSG:4326", scale=250)
    correlation = s2_resampled.addBands(modis_ndvi).reduceRegion(
        reducer=ee.Reducer.pearsonsCorrelation(),
        geometry=azraq_geom,
        scale=250,
        maxPixels=1e7
    )
    return correlation.getInfo()
```

Target: Pearson r ≥ 0.80 for the annual median over the Azraq AOI. Results stored in
`validation_records` (`validation_type = 'modis_ndvi_xcheck'`).

### 3.4 S2 vs Landsat Spectral Agreement

Where Landsat 8/9 Collection 2 SR data is available over the Azraq AOI, MIZAN performs an
annual cross-sensor NDVI agreement check to verify Sentinel-2 processing consistency.

| Metric | Target |
|--------|--------|
| Mean NDVI difference (S2 − L8) | −0.03 – +0.03 |
| RMSE | < 0.05 |
| R² | ≥ 0.90 |

If Landsat data has < 50 % cloud-free coverage in the period, the check is skipped and noted as
`insufficient_data` in `validation_records`.

### 3.5 Published ET₀ Benchmarking

MIZAN's Penman-Monteith ET₀ (FAO-56, computed in the EE Worker from ERA5-Land input variables)
is compared against:

1. **ERA5-Land `potential_evaporation`** — direct comparison; target < 10 % RMSE relative to ERA5-Land PET.
2. **ASCE Penman-Monteith ASCE-EWRI (2005) standard** — unit-test with tabulated values from the
   FAO-56 manual (Allen et al. 1998, Table C.1) for Azraq-like conditions (T≈28 °C, RH≈30 %,
   u₂≈3 m/s). The test is a deterministic unit test stored in the EE Worker test suite.
3. **Published FAO-AQUASTAT estimates for Jordan** — treated as external literature context;
   MIZAN's mean annual ET₀ for the Jordan Valley should fall in the 1 500–2 500 mm/year range
   (external reference, not a MIZAN output).

### 3.6 CHIRPS Precipitation vs ERA5-Land Cross-Check

CHIRPS and ERA5-Land precipitation are independent datasets with different methodologies. MIZAN
cross-checks them over the Azraq Basin to detect gross inconsistencies.

| Metric | Target |
|--------|--------|
| Pearson r (monthly, 5-year period) | ≥ 0.85 |
| Mean absolute error | < 20 mm/month |
| SPI-3 rank correlation | ≥ 0.80 |

Systematic divergence between the two (r < 0.70) triggers a `PRECIPITATION_DISAGREEMENT` alert
and flags the SPI metrics as `Low` confidence pending investigation.

---

## 4. Model-Level Validation

### 4.1 Validation Storage Schema

All model-level validation results are persisted in two tables:

```sql
-- Table: models (validation metrics stored as JSONB)
CREATE TABLE IF NOT EXISTS models (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT        NOT NULL UNIQUE,   -- e.g. 'rf_crop_classifier'
  name             TEXT        NOT NULL,
  version          TEXT        NOT NULL,
  algorithm        TEXT        NOT NULL,
  training_date    DATE,
  training_dataset TEXT,
  artifact_path    TEXT,                           -- GCS path to serialised model
  validation       JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: validation_records (per-run validation events)
CREATE TABLE IF NOT EXISTS validation_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id          UUID        REFERENCES models(id),
  indicator_id      UUID        REFERENCES indicators(id),
  validation_type   TEXT        NOT NULL,
  -- e.g. 'cross_validation','hold_out','jrc_surface_water_xcheck',
  --      'modis_ndvi_xcheck','s2_landsat_agreement','et0_benchmark',
  --      'input_anomaly','data_range','freshness','coverage',
  --      'event_based','stakeholder_review','sensitivity_analysis'
  status            TEXT        NOT NULL CHECK (status IN ('passed','failed','warning','skipped')),
  metrics           JSONB       NOT NULL DEFAULT '{}',
  notes             TEXT,
  run_id            TEXT,
  validated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_by      TEXT        DEFAULT 'system'
);

CREATE INDEX idx_validation_records_model_id   ON validation_records(model_id);
CREATE INDEX idx_validation_records_type       ON validation_records(validation_type);
CREATE INDEX idx_validation_records_status     ON validation_records(status);
CREATE INDEX idx_validation_records_validated  ON validation_records(validated_at DESC);
```

### 4.2 Random Forest Crop Classifier (`rf_crop_classifier`)

**Protocol:** Stratified k-fold (k=5) cross-validation with one held-out geographic sub-region
(spatial holdout to avoid spatial autocorrelation leakage). Training data: labelled field polygons
from reference datasets (Sentinel-2 + MODIS time-series features).

**Stored metrics in `models.validation` JSONB:**

```json
{
  "protocol": "stratified_5fold_plus_spatial_holdout",
  "n_samples_train": null,
  "n_samples_test_holdout": null,
  "cv_mean_oa": null,
  "cv_std_oa": null,
  "holdout_oa": null,
  "kappa": null,
  "per_class": {
    "irrigated_crop": {"precision": null, "recall": null, "f1": null, "support": null},
    "dryland_crop":   {"precision": null, "recall": null, "f1": null, "support": null},
    "bare_soil":      {"precision": null, "recall": null, "f1": null, "support": null},
    "urban":          {"precision": null, "recall": null, "f1": null, "support": null},
    "water":          {"precision": null, "recall": null, "f1": null, "support": null},
    "shrubland":      {"precision": null, "recall": null, "f1": null, "support": null}
  },
  "confusion_matrix": null,
  "feature_importances_shap": null,
  "random_seed": 42,
  "training_date": null,
  "notes": "Values populated during Phase 2 model training run"
}
```

**Acceptance thresholds (minimum to pass):**

| Metric | Minimum Required |
|--------|-----------------|
| Overall accuracy (OA) on holdout | ≥ 0.80 |
| Cohen's Kappa | ≥ 0.75 |
| `irrigated_crop` F1 | ≥ 0.75 |
| Any per-class recall | ≥ 0.60 |

Failure to meet thresholds blocks promotion of the model to production (`models.artifact_path`
is not updated in the production secrets). A `validation_records` row with `status = 'failed'`
is created and an alert dispatched.

### 4.3 XGBoost Irrigation Detector (`xgb_irrigation_detector`)

**Protocol:** Stratified 5-fold CV on temporal blocks (to prevent temporal leakage), plus one
held-out season (e.g., summer 2023 withheld entirely from training).

**Stored metrics:**

```json
{
  "protocol": "temporal_5fold_plus_holdout_season",
  "holdout_season": "2023-summer",
  "cv_mean_auc_roc": null,
  "cv_std_auc_roc": null,
  "holdout_auc_roc": null,
  "pr_auc": null,
  "f1_at_0_5_threshold": null,
  "f1_at_optimal_threshold": null,
  "optimal_threshold": null,
  "calibration_brier_score": null,
  "calibration_log_loss": null,
  "feature_importances_shap": null,
  "class_imbalance_ratio": null,
  "random_seed": 42
}
```

**Acceptance thresholds:**

| Metric | Minimum Required |
|--------|-----------------|
| AUC-ROC | ≥ 0.82 |
| PR-AUC | ≥ 0.70 |
| F1 (threshold-optimised) | ≥ 0.75 |
| Brier score | ≤ 0.15 |

Calibration plots (reliability diagrams) are generated at training time and stored as PNG
artifacts in Cloud Storage, linked from `models.validation`.

### 4.4 Isolation Forest Anomaly Detector (`iforest_anomaly`)

The IsolationForest anomaly detector has no class labels for conventional accuracy metrics. Its
validation is qualitative and scenario-based:

1. **Known drought injection test** — inject feature vectors derived from a known CHIRPS drought
   event (e.g., 2021 Jordan dry winter) and verify `anomaly_score > 0.6`.
2. **Normal-period stability test** — inject feature vectors from a high-rainfall year (e.g., 2019)
   and verify that < 10 % of samples score > 0.6.
3. **Contamination parameter sensitivity** — test with `contamination ∈ {0.05, 0.10, 0.15}` and
   choose the value minimising false positives on the known-normal period.
4. **Distribution overlap check** — anomaly scores from "normal" samples must have median < 0.3;
   anomaly scores from "stress" samples must have median > 0.55.

```json
{
  "protocol": "scenario_based_injection",
  "drought_test_recall": null,
  "normal_period_fpr": null,
  "contamination_selected": 0.10,
  "median_score_normal": null,
  "median_score_stress": null,
  "n_training_samples": null
}
```

### 4.5 Penman-Monteith ET₀ (Deterministic)

As a deterministic equation (not a trained model), PM-ET₀ is validated through unit tests and
benchmarking rather than cross-validation:

1. **Tabulated value unit test** — compare computed ET₀ against FAO-56 Appendix C example values;
   tolerance: ± 2 % of reference value.
2. **ERA5-Land comparison** — correlation between MIZAN PM-ET₀ and ERA5-Land `potential_evaporation`
   over the Azraq Basin; target Pearson r ≥ 0.90, mean bias < 10 %.
3. **Physical bounds test** — ET₀ must be ≥ 0 and < 15 mm/day for all Jordan grid points.
4. **Mass balance sanity** — annual cumulative ET₀ for Azraq must be in the range 1 000–2 500 mm/year,
   consistent with published FAO-AQUASTAT estimates for Jordan (treated as external context).

### 4.6 Groundwater Stress Model (`gw_stress_model`)

The GW Stress composite is a deterministic weighted sum of sub-index scores (see doc 08). Its
validation combines sensitivity analysis, event-based validation, and stakeholder review.

#### 4.6.1 Sensitivity Analysis

A one-at-a-time (OAT) sensitivity test perturbs each sub-index weight by ±25 % while holding
others constant. The resulting change in the composite score must not exceed ±12 points on the
0–100 scale, confirming that no single weight dominates the model.

```python
# Illustrative: Python sensitivity analysis pseudo-code
BASE_WEIGHTS = {
    "abstraction_pressure": 0.30,
    "recharge_deficit":     0.25,
    "veg_water_divergence": 0.20,
    "surface_water_decline":0.15,
    "grace_tws_anomaly":    0.10,
}

def sensitivity_oat(base_score: float, sub_index_scores: dict, perturbation=0.25):
    results = {}
    for key, base_w in BASE_WEIGHTS.items():
        perturbed = {k: v for k, v in BASE_WEIGHTS.items()}
        perturbed[key] *= (1 + perturbation)
        # Renormalise weights to sum to 1
        total = sum(perturbed.values())
        perturbed = {k: v / total for k, v in perturbed.items()}
        new_score = sum(perturbed[k] * sub_index_scores[k] for k in perturbed)
        results[key] = {"delta": abs(new_score - base_score)}
    return results
```

#### 4.6.2 Event-Based Validation

The model output is checked for directional consistency against documented historical events:

| Event | Expected Model Behaviour | Data Source |
|-------|--------------------------|-------------|
| Azraq Oasis near-desiccation (1990s) | GW Stress Index: Severe (75–100) | JRC GSW historical; published literature |
| CHIRPS below-average precipitation years (e.g., 2008, 2014, 2021) | GW Stress Index increases vs 5-year baseline | CHIRPS time series |
| Partial oasis recovery post-2007 (RSCN restoration) | Surface-water sub-index: modest improvement | JRC GSW |
| Post-2015 agricultural expansion near Azraq | Abstraction pressure sub-index: sustained High | S2 land-cover change |

Results are logged to `validation_records` (`validation_type = 'event_based'`). The model does
NOT need to reproduce exact historical index values (data for the 1990s is sparse); it must show
the correct *directional* response.

#### 4.6.3 Stakeholder Review

A structured review by MWI and RSCN representatives is planned for Phase 2. The review protocol
is:

1. Analysts review model outputs for years 2018–2024 against their institutional knowledge.
2. Reviewers assign a qualitative rating (Consistent / Partially Consistent / Inconsistent) per
   year and sub-index.
3. Ratings and commentary are stored in `validation_records` (`validation_type = 'stakeholder_review'`,
   `validated_by = 'rscn_officer'` or `'mwi_analyst'`).
4. Inconsistencies trigger a model re-parameterisation review before Phase 3.

### 4.7 SHAP Explainer Validation

SHAP values are validated for internal consistency:

1. **Sum consistency** — The sum of all SHAP values for a prediction must equal the prediction
   minus the expected value (baseline). Checked programmatically; tolerance: 1 × 10⁻⁶.
2. **Sign consistency** — SHAP values for features known to increase stress (e.g., irrigated area)
   must be positive for high-stress predictions.
3. **Feature importance stability** — Top-3 SHAP features across bootstrap replicates (n=50) must
   appear in top-5 in ≥ 80 % of replicates.

### 4.8 Drift Monitoring

Model drift is monitored via scheduled comparison of recent predictions against training-set
statistics:

```sql
-- Illustrative: model_drift_checks materialised view
CREATE MATERIALIZED VIEW model_drift_summary AS
SELECT
  m.code                                             AS model_code,
  DATE_TRUNC('month', iv.observation_date)           AS month,
  AVG(iv.value)                                      AS mean_prediction,
  STDDEV(iv.value)                                   AS std_prediction,
  COUNT(*)                                           AS n_predictions
FROM indicator_values iv
JOIN indicators i ON i.id = iv.indicator_id
JOIN models m ON m.code = i.model_code
WHERE iv.observation_date >= NOW() - INTERVAL '12 months'
GROUP BY m.code, DATE_TRUNC('month', iv.observation_date)
ORDER BY m.code, month;
```

A drift alert is raised if:
- Mean prediction shifts > 1.5 standard deviations from the training-set mean for 3 consecutive months.
- Prediction variance doubles vs the training baseline.

---

## 5. Ground-Truth Strategy

### 5.1 Principles

MIZAN operates in a data-sparse environment. The ground-truth strategy is honest about this:

- **No fabrication rule applies to ground truth** — MIZAN never invents reference measurements,
  inflates agreement statistics, or selects validation samples to improve reported accuracy.
- **Sources of ground truth** are documented, dated, and attributed to their original publishers.
- **Data gaps are acknowledged** explicitly in `validation_records` and in the Validation Center UI.

### 5.2 Ground-Truth Sources

| Source | Type | Coverage | Availability | Use in MIZAN |
|--------|------|----------|-------------|--------------|
| RSCN Azraq Wetland survey data | Point observations; wetland extent | Azraq Oasis | Limited; by arrangement | Surface-water validation |
| MWI irrigation licence database | Administrative polygon | Jordan | Restricted access | Irrigated-area validation (where accessible) |
| FAO GAUL administrative boundaries | Vector polygons | National/global | Open (CC) | Spatial context; AOI definition |
| Published peer-reviewed Azraq studies | Literature values | Azraq Basin | Open access | Event-based validation; context only |
| High-resolution commercial imagery interpretation | Manually labelled polygons | Azraq Basin sample | Phase 2 acquisition | Irrigated-area accuracy |
| CHIRPS v2.0 station-blended precipitation | Semi-ground-truth | Jordan | Open (CC) | NDVI and SPI cross-check |
| Field campaign (planned, Phase 2) | Soil sampling, crop ID | Azraq 50-point transect | Phase 2 | RF crop classifier ground-truth |

### 5.3 `validation_records` Table Usage

Every ground-truth comparison writes a record:

```sql
-- Illustrative: inserting a JRC cross-check validation record
INSERT INTO validation_records (
  model_id, indicator_id, validation_type, status, metrics, notes, run_id, validated_by
) VALUES (
  NULL,
  (SELECT id FROM indicators WHERE code = 'AZRAQ_SURFACE_WATER_EXTENT'),
  'jrc_surface_water_xcheck',
  'passed',
  '{
    "mizan_area_km2": 12.4,
    "jrc_area_km2": 11.9,
    "area_diff_pct": 4.2,
    "spearman_rho_seasonal": 0.87,
    "trend_agreement": true
  }',
  'Annual 2023 cross-check; cloud cover < 10% in both datasets',
  'run_20240115_gee_003',
  'system'
);
```

### 5.4 Acknowledging Ground-Truth Gaps

The following limitations are formally acknowledged and surfaced in the Validation Center UI:

1. **No in-situ piezometer data** — MIZAN does not have access to MWI borehole water-level records.
   The GW Stress Index cannot be validated against direct groundwater level measurements. This is
   the primary limitation; see also doc 20.
2. **Historical imagery before 2017 (S2)** — Sentinel-2 coverage before 2017 is limited or absent
   for parts of the Azraq Basin; Landsat 8 (2013+) is used for pre-S2 continuity with documented
   cross-sensor uncertainty.
3. **GRACE resolution** — GRACE/GRACE-FO mascons at ~300 km resolution cannot resolve sub-basin
   groundwater variation; the TWS anomaly is used as a regional context signal only, not a
   basin-specific measurement.
4. **Sparse labelled training data** — Crop classification labels covering the Azraq Basin are
   limited. Phase 2 field campaigns are required to improve classifier performance and reduce label
   uncertainty.

---

## 6. Validation Envelope Enforcement

### 6.1 The Five-Field Validation Envelope

Every indicator value exposed to the UI, API, or AI model must carry a complete Validation
Envelope. The five fields are:

| Field | Content |
|-------|---------|
| **Source** | Dataset GEE collection ID or model code (e.g., `COPERNICUS/S2_SR_HARMONIZED`, `rf_crop_classifier v1.2`) |
| **Date** | Observation date or date range; pipeline run timestamp |
| **Methodology** | Algorithm name and version (e.g., `NDVI = (B8-B4)/(B8+B4), S2 SR, cloud_mask QA60, median composite`) |
| **Confidence** | Numeric score [0,1] + level label (`High ≥ 0.80 / Medium 0.50–0.79 / Low < 0.50`) |
| **Explanation** | Plain-language statement of what the value means, its limitations, and the scientific stance caveat |

### 6.2 Database Enforcement

The `indicator_values` table enforces envelope completeness via a trigger:

```sql
-- Illustrative: trigger enforcing envelope completeness before display
CREATE OR REPLACE FUNCTION check_envelope_completeness()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confidence_id IS NULL THEN
    RAISE EXCEPTION 'indicator_values row requires a confidence_id (envelope: confidence)';
  END IF;
  IF NEW.provenance_id IS NULL THEN
    RAISE EXCEPTION 'indicator_values row requires a provenance_id (envelope: source + methodology)';
  END IF;
  IF NEW.explanation IS NULL OR TRIM(NEW.explanation) = '' THEN
    RAISE EXCEPTION 'indicator_values row requires a non-empty explanation (envelope: explanation)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_envelope_completeness
  BEFORE INSERT OR UPDATE ON indicator_values
  FOR EACH ROW EXECUTE FUNCTION check_envelope_completeness();
```

### 6.3 Validation Center Page

The Validation Center (`/validation`) — specified in detail in doc 13 — surfaces the envelope for
every metric. Key UI components:

- **Validation status badge** per indicator: `Passed ✓ / Warning ⚠ / Failed ✗ / Pending`.
- **Envelope detail drawer** — click any metric to expand all five envelope fields with source
  citations.
- **Cross-check table** — side-by-side comparison of MIZAN values vs independent sources (JRC,
  MODIS, ERA5-Land) where available.
- **Model performance panel** — accuracy, F1, AUC-ROC cards pulled from `models.validation` JSONB.
- **Limitation disclosure banner** — always-visible statement of known ground-truth gaps.
- **Validation log** — paginated view of recent `validation_records` entries, filterable by type
  and status.

---

## 7. Reproducibility

### 7.1 Data Snapshots

Each scheduled EE Worker run creates a `data_snapshot` record:

```json
{
  "run_id": "run_20240115_gee_003",
  "aoi": "azraq_basin_v2",
  "date_range": {"start": "2023-12-01", "end": "2023-12-31"},
  "collections": {
    "s2_sr": {"id": "COPERNICUS/S2_SR_HARMONIZED", "n_images": 14, "cloud_pct": 8.3},
    "s1_grd": {"id": "COPERNICUS/S1_GRD", "n_images": 6},
    "chirps": {"id": "UCSB-CHG/CHIRPS/DAILY", "n_images": 31}
  },
  "ee_project": "mizan-ee-prod",
  "worker_version": "1.3.2",
  "python_env_hash": "sha256:abc123..."
}
```

This record is linked to every `indicator_values` row produced by the run via the `provenance`
table, ensuring any value can be exactly attributed to the input data that produced it.

### 7.2 Random Seeds

All stochastic operations in MIZAN use fixed, documented seeds:

| Operation | Seed | Where Documented |
|-----------|------|-----------------|
| RF crop classifier `random_state` | 42 | `models.validation` JSONB |
| XGBoost `seed` | 42 | `models.validation` JSONB |
| IsolationForest `random_state` | 42 | `models.validation` JSONB |
| Train/test split | 42 | `models.validation` JSONB |
| Bootstrap replicates (SHAP stability) | 1000 | Worker config |

### 7.3 Versioned Pipelines and Models

- EE Worker Docker image is tagged with a semantic version (e.g., `mizan-ee-worker:1.3.2`).
- Model artifacts are stored in GCS with a path schema:
  `gs://mizan-models/{model_code}/{version}/{artifact_filename}`.
- `models.version` is updated on every retrain; old versions are retained (not deleted) for
  reproducibility.
- Database migrations are versioned via Supabase migration files; see doc 18.

---

## 8. Acceptance Criteria and Test Plan

### 8.1 Acceptance Criteria Summary

| Layer | Criterion | Gate |
|-------|-----------|------|
| Data | 100 % of `indicator_values` rows pass range checks | CI unit test |
| Data | 0 stale primary indicators at time of staging deploy | CI freshness check |
| Data | Spatial coverage ≥ threshold for all primary indicators | CI coverage check |
| Method | JRC surface-water agreement area diff < 15 % | Annual validation run |
| Method | MODIS NDVI Pearson r ≥ 0.80 | Annual validation run |
| Method | ET₀ unit test passes within ± 2 % FAO-56 reference | CI unit test |
| Model | RF OA ≥ 0.80 on holdout | Model promotion gate |
| Model | XGBoost AUC-ROC ≥ 0.82 | Model promotion gate |
| Model | IsolationForest drought-injection recall > 0.70 | Scenario test |
| Product | 100 % of displayed metrics have complete envelope | Integration test |
| Product | Confidence score coverage 100 % | DB constraint + test |
| Product | GW Stress OAT sensitivity delta < ±12 pts | Automated sensitivity run |
| Product | Event-based validation: all documented events show correct direction | Manual review, Phase 2 |

### 8.2 Unit Tests

Unit tests live in the EE Worker repository (`/tests/unit/`) and the Supabase Edge Functions test
suite (`/supabase/functions/__tests__/`).

| Test | Location | Covers |
|------|----------|--------|
| `test_ndvi_range` | Worker unit | NDVI output ∈ [−1, 1] for synthetic input |
| `test_ndwi_range` | Worker unit | NDWI output ∈ [−1, 1] |
| `test_pm_et0_fao56` | Worker unit | PM-ET₀ vs FAO-56 Table C.1 tabulated values |
| `test_spi_standardisation` | Worker unit | SPI output ∈ [−4, +4]; mean ≈ 0 |
| `test_confidence_formula` | Worker unit | Geometric-mean confidence ∈ [0,1] |
| `test_shap_sum_consistency` | Worker unit | Sum of SHAP values = prediction − baseline |
| `test_envelope_trigger` | DB integration | INSERT without `confidence_id` raises exception |
| `test_iforest_anomaly_range` | Worker unit | `anomaly_score` ∈ [0, 1] |
| `test_stress_index_bounds` | Worker unit | GW Stress ∈ [0, 100] |
| `test_sensitivity_delta` | Worker unit | OAT sensitivity delta < 12 pts |
| `test_quarantine_redirect` | DB integration | Out-of-range value routed to quarantine |

### 8.3 Integration Tests

Integration tests run against a Supabase local stack (see doc 18) and a mock GEE environment.

| Test | Covers |
|------|--------|
| EE Worker → Supabase pipeline (mock GEE) | End-to-end insert with provenance and confidence |
| `ee-compute` Edge Function response shape | API contract per doc 12 |
| `confidence` Edge Function output schema | Confidence record creation + envelope fields |
| `risk-score` Edge Function | GW Stress computation from mock sub-index values |
| `ai-insights` Edge Function | Response grounded; no secrets in output; no hallucinated numbers |
| PostgREST RLS: viewer cannot read admin data | Access control |
| PostgREST RLS: analyst can export indicator data | Access control |
| Validation envelope trigger prevents incomplete rows | DB integrity |

### 8.4 End-to-End Tests

E2E tests use Playwright and run against the staging environment.

| Test | Pages |
|------|-------|
| Landing page loads national indicators | `/` |
| Azraq GW Stress panel shows value + confidence badge | `/azraq` |
| Map layer toggle shows NDVI tiles | `/map` |
| Validation Center shows envelope for NDVI | `/validation` |
| AI insight response contains source citations | `/ai` |
| Judge Mode: all 6 deliverable tabs accessible | `/judge` |
| Arabic locale: no RTL layout breakage | All pages |

### 8.5 CI Gates

The CI/CD pipeline (see doc 18) enforces the following gates before any deploy:

```yaml
# Illustrative: GitHub Actions validation gate steps
- name: Unit tests — EE Worker
  run: pytest tests/unit/ --tb=short -q

- name: Unit tests — Confidence formula
  run: pytest tests/unit/test_confidence.py -v

- name: Type check — Edge Functions
  run: deno check supabase/functions/**/*.ts

- name: DB migration dry-run
  run: supabase db diff --local

- name: Envelope constraint test
  run: pytest tests/integration/test_envelope_trigger.py

- name: Model validation metrics present
  run: python scripts/check_model_validation_populated.py

- name: Freshness check
  run: python scripts/check_indicator_freshness.py --env staging
```

Any failing gate blocks the deployment to staging; no partial deploys are permitted.

---

## 9. Deliverables Mapping

| AstroCode Deliverable | Validation Framework Contribution |
|-----------------------|-----------------------------------|
| **Functional Prototype** | Acceptance criteria gate ensures only validated data reaches production |
| **Data Explanation** | Validation Envelope (five fields) on every displayed metric; cross-check results in Validation Center |
| **AI/Analytics Method** | Model validation protocols (CV, holdout, confusion matrices, calibration, SHAP); event-based validation of GW Stress model |
| **Results Visualization** | Validation status badges and limitation banners in the UI; validation log accessible to analysts |
| **Jordanian Use Case** | Event-based validation against documented Azraq Basin history; stakeholder review protocol with MWI/RSCN |
| **Impact Statement** | Reproducibility guarantees (snapshots, seeds, versions) ensure impact claims are traceable and defensible |

---

*End of Document 16 — Validation Framework*
