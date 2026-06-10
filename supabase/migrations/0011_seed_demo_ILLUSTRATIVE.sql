-- =============================================================================
-- 0011_seed_demo_ILLUSTRATIVE.sql
-- MIZAN — LOCAL DEMO SEED (SYNTHETIC / ILLUSTRATIVE ONLY)
-- =============================================================================
--
-- ██╗    ██╗ █████╗ ██████╗ ███╗   ██╗██╗███╗   ██╗ ██████╗
-- ██║    ██║██╔══██╗██╔══██╗████╗  ██║██║████╗  ██║██╔════╝
-- ██║ █╗ ██║███████║██████╔╝██╔██╗ ██║██║██╔██╗ ██║██║  ███╗
-- ██║███╗██║██╔══██║██╔══██╗██║╚██╗██║██║██║╚██╗██║██║   ██║
-- ╚███╔███╔╝██║  ██║██║  ██║██║ ╚████║██║██║ ╚████║╚██████╔╝
--  ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═══╝ ╚═════╝
--
--  THIS FILE IS FOR LOCAL DEVELOPMENT AND SCHEMA DEMONSTRATION ONLY.
--
--  ALL VALUES IN THIS FILE ARE SYNTHETIC / ILLUSTRATIVE.
--  They are NOT real Earth Observation data, NOT real sensor measurements,
--  and NOT validated scientific assessments of the Azraq Basin or Jordan.
--
--  Per the MIZAN Implementation Contract:
--    • Every provenance.source in this file STARTS WITH:
--        "ILLUSTRATIVE DEMO (synthetic) — not a real EO observation"
--    • Every confidence_scores.level in this file is 'Low'.
--    • This file MUST NOT be applied to staging or production databases.
--
--  DO NOT cite or publish the values below as real environmental data.
--  The non-fabrication invariant (docs/11 §14) applies in production:
--  replace this entire seed with real EE Worker outputs before any
--  real-world use.
-- =============================================================================

-- Wrap in a transaction so the entire demo seed is atomic.
BEGIN;

-- ---------------------------------------------------------------------------
-- STEP 0: resolve catalog UUIDs into local variables.
-- We do this via CTEs in each statement to avoid PL/pgSQL and stay
-- idempotent SQL (no variable binding needed; ON CONFLICT handles re-runs).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- STEP 1: provenance rows for demo indicator values
-- One provenance record per synthetic indicator batch.
-- Source MUST start with "ILLUSTRATIVE DEMO (synthetic)".
-- ---------------------------------------------------------------------------
WITH
  r  AS (SELECT id FROM regions    WHERE code = 'azraq_basin'),
  ds AS (SELECT id FROM datasets   WHERE key  = 'chirps_daily'),
  ds_s2 AS (SELECT id FROM datasets WHERE key = 's2_sr_harmonized'),
  ds_era5 AS (SELECT id FROM datasets WHERE key = 'era5_land_daily')

INSERT INTO provenance (
  id, source, dataset_id, ee_asset_id,
  period_start, period_end,
  processing_method, processing_version, parameters, computed_by
) VALUES
  -- Precipitation provenance
  (
    '11111111-0001-0001-0001-000000000001',
    'ILLUSTRATIVE DEMO (synthetic) — not a real EO observation; CHIRPS daily synthetic precip for Azraq Basin demo',
    (SELECT id FROM ds),
    'UCSB-CHG/CHIRPS/DAILY',
    '2024-01-01', '2024-03-31',
    'CHIRPS zonal mean over Azraq Basin bbox (synthetic demo)',
    '0.0.1-demo',
    '{"note": "SYNTHETIC — illustrative only", "region": "azraq_basin"}'::jsonb,
    'demo_seed_0011'
  ),
  -- NDVI provenance
  (
    '11111111-0001-0001-0001-000000000002',
    'ILLUSTRATIVE DEMO (synthetic) — not a real EO observation; Sentinel-2 SR median composite NDVI for Azraq Basin demo',
    (SELECT id FROM ds_s2),
    'COPERNICUS/S2_SR_HARMONIZED',
    '2024-01-01', '2024-03-31',
    'S2 10-day median composite, NDVI = (B8-B4)/(B8+B4), cloud mask applied (synthetic demo)',
    '0.0.1-demo',
    '{"note": "SYNTHETIC — illustrative only", "cloud_threshold_pct": 30, "region": "azraq_basin"}'::jsonb,
    'demo_seed_0011'
  ),
  -- NDWI provenance
  (
    '11111111-0001-0001-0001-000000000003',
    'ILLUSTRATIVE DEMO (synthetic) — not a real EO observation; Sentinel-2 SR NDWI for Azraq Basin demo',
    (SELECT id FROM ds_s2),
    'COPERNICUS/S2_SR_HARMONIZED',
    '2024-01-01', '2024-03-31',
    'S2 10-day median composite, NDWI = (B3-B8)/(B3+B8), cloud mask applied (synthetic demo)',
    '0.0.1-demo',
    '{"note": "SYNTHETIC — illustrative only", "cloud_threshold_pct": 30, "region": "azraq_basin"}'::jsonb,
    'demo_seed_0011'
  ),
  -- Surface water extent provenance
  (
    '11111111-0001-0001-0001-000000000004',
    'ILLUSTRATIVE DEMO (synthetic) — not a real EO observation; surface water extent from MNDWI threshold for Azraq Basin demo',
    (SELECT id FROM ds_s2),
    'COPERNICUS/S2_SR_HARMONIZED',
    '2024-01-01', '2024-03-31',
    'MNDWI > 0.0 threshold applied to S2 10-day median composite; open water area (synthetic demo)',
    '0.0.1-demo',
    '{"note": "SYNTHETIC — illustrative only", "mndwi_threshold": 0.0, "region": "azraq_basin"}'::jsonb,
    'demo_seed_0011'
  ),
  -- SPI-3 provenance
  (
    '11111111-0001-0001-0001-000000000005',
    'ILLUSTRATIVE DEMO (synthetic) — not a real EO observation; SPI-3 from CHIRPS for Azraq Basin demo',
    (SELECT id FROM ds),
    'UCSB-CHG/CHIRPS/DAILY',
    '2024-01-01', '2024-03-31',
    'SPI-3 computed from CHIRPS 3-month accumulation using 1981–2023 climatology (synthetic demo)',
    '0.0.1-demo',
    '{"note": "SYNTHETIC — illustrative only", "climatology_start": 1981, "climatology_end": 2023, "region": "azraq_basin"}'::jsonb,
    'demo_seed_0011'
  ),
  -- Irrigated area provenance
  (
    '11111111-0001-0001-0001-000000000006',
    'ILLUSTRATIVE DEMO (synthetic) — not a real EO observation; irrigated area from XGBoost irrigation detector for Azraq Basin demo',
    (SELECT id FROM ds_s2),
    'COPERNICUS/S2_SR_HARMONIZED',
    '2024-01-01', '2024-03-31',
    'XGBoost irrigation detector applied to S2 multi-temporal stack; irrigated parcel area aggregated (synthetic demo)',
    '0.0.1-demo',
    '{"note": "SYNTHETIC — illustrative only", "model_key": "xgb_irrigation_detector", "region": "azraq_basin"}'::jsonb,
    'demo_seed_0011'
  ),
  -- Abstraction estimate provenance
  (
    '11111111-0001-0001-0001-000000000007',
    'ILLUSTRATIVE DEMO (synthetic) — not a real EO observation; abstraction estimate from irrigated area × ET0 × Kc for Azraq Basin demo',
    (SELECT id FROM ds_era5),
    'ECMWF/ERA5_LAND/DAILY_AGGR',
    '2024-01-01', '2024-03-31',
    'Abstraction = irrigated_area_ha × Kc × ET0_pm_mm / 10000 × 1000 (mm→MCM); Kc=0.85 assumed (synthetic demo)',
    '0.0.1-demo',
    '{"note": "SYNTHETIC — illustrative only", "kc": 0.85, "region": "azraq_basin"}'::jsonb,
    'demo_seed_0011'
  ),
  -- Water balance provenance
  (
    '11111111-0001-0001-0001-000000000008',
    'ILLUSTRATIVE DEMO (synthetic) — not a real EO observation; water balance = recharge_proxy minus abstraction for Azraq Basin demo',
    (SELECT id FROM ds),
    NULL,
    '2024-01-01', '2024-03-31',
    'Water balance (MCM) = recharge_proxy_mm × basin_area_km2 / 1000 − abstraction_estimate_mcm (synthetic demo)',
    '0.0.1-demo',
    '{"note": "SYNTHETIC — illustrative only", "basin_area_km2": 12800, "region": "azraq_basin"}'::jsonb,
    'demo_seed_0011'
  ),
  -- Risk score provenance
  (
    '11111111-0001-0001-0001-000000000009',
    'ILLUSTRATIVE DEMO (synthetic) — not a real EO observation; gw_stress_model composite risk score for Azraq Basin demo',
    NULL,
    NULL,
    '2024-01-01', '2024-03-31',
    'gw_stress_model: weighted composite of 5 sub-indices; weights per docs/08 (synthetic demo)',
    '0.0.1-demo',
    '{"note": "SYNTHETIC — illustrative only", "model_key": "gw_stress_model", "region": "azraq_basin"}'::jsonb,
    'demo_seed_0011'
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- STEP 2: indicator_values — 8 synthetic observations for Azraq Basin
-- obs_date = 2024-03-31 (end of Q1 2024 demo period)
-- All values are plausible-looking but SYNTHETIC.
-- ---------------------------------------------------------------------------
WITH
  region  AS (SELECT id FROM regions    WHERE code  = 'azraq_basin'),
  i_precip   AS (SELECT id FROM indicators WHERE code = 'precip_mm'),
  i_ndvi     AS (SELECT id FROM indicators WHERE code = 'ndvi'),
  i_ndwi     AS (SELECT id FROM indicators WHERE code = 'ndwi'),
  i_swext    AS (SELECT id FROM indicators WHERE code = 'surface_water_extent_km2'),
  i_spi3     AS (SELECT id FROM indicators WHERE code = 'spi_3'),
  i_irr      AS (SELECT id FROM indicators WHERE code = 'irrigated_area_ha'),
  i_abst     AS (SELECT id FROM indicators WHERE code = 'abstraction_estimate_mcm'),
  i_wb       AS (SELECT id FROM indicators WHERE code = 'water_balance_mcm')

INSERT INTO indicator_values (
  id, region_id, indicator_id, obs_date, value, confidence, provenance_id
)
SELECT vals.id, (SELECT id FROM region), vals.indicator_id, vals.obs_date,
       vals.value, vals.confidence, vals.provenance_id
FROM (VALUES
  -- precip_mm: ~58 mm Q1 2024 (below normal for Azraq; ~72 mm climatological mean)
  (
    '22222222-0002-0002-0002-000000000001'::uuid,
    (SELECT id FROM i_precip),
    '2024-03-31'::date,
    58.3,      -- mm; synthetic; below-normal Q1 precip
    0.310::numeric(4,3),
    '11111111-0001-0001-0001-000000000001'::uuid
  ),
  -- ndvi: ~0.18 (low; stressed dryland vegetation in dry season)
  (
    '22222222-0002-0002-0002-000000000002'::uuid,
    (SELECT id FROM i_ndvi),
    '2024-03-31'::date,
    0.18,
    0.310::numeric(4,3),
    '11111111-0001-0001-0001-000000000002'::uuid
  ),
  -- ndwi: ~-0.32 (negative; dry conditions, minimal surface moisture)
  (
    '22222222-0002-0002-0002-000000000003'::uuid,
    (SELECT id FROM i_ndwi),
    '2024-03-31'::date,
    -0.32,
    0.310::numeric(4,3),
    '11111111-0001-0001-0001-000000000003'::uuid
  ),
  -- surface_water_extent_km2: ~4.2 km² (Azraq wetland; historically ~12 km²; heavily reduced)
  (
    '22222222-0002-0002-0002-000000000004'::uuid,
    (SELECT id FROM i_swext),
    '2024-03-31'::date,
    4.2,
    0.310::numeric(4,3),
    '11111111-0001-0001-0001-000000000004'::uuid
  ),
  -- spi_3: ~-1.6 (moderately severe drought; < -1.5 = severe drought class)
  (
    '22222222-0002-0002-0002-000000000005'::uuid,
    (SELECT id FROM i_spi3),
    '2024-03-31'::date,
    -1.6,
    0.310::numeric(4,3),
    '11111111-0001-0001-0001-000000000005'::uuid
  ),
  -- irrigated_area_ha: ~18,400 ha (Azraq agricultural area; growing over past decade)
  (
    '22222222-0002-0002-0002-000000000006'::uuid,
    (SELECT id FROM i_irr),
    '2024-03-31'::date,
    18400.0,
    0.310::numeric(4,3),
    '11111111-0001-0001-0001-000000000006'::uuid
  ),
  -- abstraction_estimate_mcm: ~63.5 MCM Q1 (annualised ~254 MCM; above ~120 MCM safe yield)
  (
    '22222222-0002-0002-0002-000000000007'::uuid,
    (SELECT id FROM i_abst),
    '2024-03-31'::date,
    63.5,
    0.310::numeric(4,3),
    '11111111-0001-0001-0001-000000000007'::uuid
  ),
  -- water_balance_mcm: ~-47.2 MCM (recharge ~16.3 MCM − abstraction 63.5 MCM = deficit)
  (
    '22222222-0002-0002-0002-000000000008'::uuid,
    (SELECT id FROM i_wb),
    '2024-03-31'::date,
    -47.2,
    0.310::numeric(4,3),
    '11111111-0001-0001-0001-000000000008'::uuid
  )
) AS vals(id, indicator_id, obs_date, value, confidence, provenance_id)
ON CONFLICT (region_id, indicator_id, obs_date, provenance_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- STEP 3: risk_scores — one synthetic "High" stress result for Q1 2024
-- gw_stress_index = 71.5 → class 'High' (50–75 range)
-- components follow the canonical jsonb shape from docs/11 §6.4.
-- ---------------------------------------------------------------------------
INSERT INTO risk_scores (
  id,
  region_id,
  period_start,
  period_end,
  gw_stress_index,
  gw_stress_class,
  components,
  confidence,
  provenance_id
)
SELECT
  '33333333-0003-0003-0003-000000000001'::uuid,
  r.id,
  '2024-01-01',
  '2024-03-31',
  71.5,            -- synthetic; High class (50–75)
  'High'::gw_stress_class,
  '{
    "abstraction_pressure":   {"value": 0.78, "weight": 0.30},
    "recharge_deficit":       {"value": 0.72, "weight": 0.25},
    "veg_water_divergence":   {"value": 0.65, "weight": 0.20},
    "surface_water_decline":  {"value": 0.80, "weight": 0.15},
    "regional_storage_grace": {"value": 0.55, "weight": 0.10}
  }'::jsonb,
  0.310::numeric(4,3),
  '11111111-0001-0001-0001-000000000009'::uuid
FROM regions r
WHERE r.code = 'azraq_basin'
ON CONFLICT (region_id, period_start, period_end, provenance_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- STEP 4: risk_factors — one row per sub-index (5 rows)
-- factor_value = normalized [0,1] input before weighting
-- weighted_value = factor_value × weight
-- ---------------------------------------------------------------------------
INSERT INTO risk_factors (
  id,
  risk_score_id,
  factor_key,
  factor_value,
  weight,
  weighted_value,
  detail
) VALUES
  (
    '44444444-0004-0004-0004-000000000001',
    '33333333-0003-0003-0003-000000000001',
    'abstraction_pressure',
    0.78,
    0.30::numeric(4,3),
    0.234,  -- 0.78 × 0.30
    '{"note": "SYNTHETIC — illustrative only; abstraction_estimate_mcm 63.5 vs safe_yield_proxy_mcm 29.0"}'::jsonb
  ),
  (
    '44444444-0004-0004-0004-000000000002',
    '33333333-0003-0003-0003-000000000001',
    'recharge_deficit',
    0.72,
    0.25::numeric(4,3),
    0.180,  -- 0.72 × 0.25
    '{"note": "SYNTHETIC — illustrative only; spi_3 -1.6 normalised to deficit score"}'::jsonb
  ),
  (
    '44444444-0004-0004-0004-000000000003',
    '33333333-0003-0003-0003-000000000001',
    'veg_water_divergence',
    0.65,
    0.20::numeric(4,3),
    0.130,  -- 0.65 × 0.20
    '{"note": "SYNTHETIC — illustrative only; ndvi 0.18 vs et0 proxy implies crop water stress divergence"}'::jsonb
  ),
  (
    '44444444-0004-0004-0004-000000000004',
    '33333333-0003-0003-0003-000000000001',
    'surface_water_decline',
    0.80,
    0.15::numeric(4,3),
    0.120,  -- 0.80 × 0.15
    '{"note": "SYNTHETIC — illustrative only; surface_water_extent_km2 4.2 vs historical ~12 km² = -65%"}'::jsonb
  ),
  (
    '44444444-0004-0004-0004-000000000005',
    '33333333-0003-0003-0003-000000000001',
    'regional_storage_grace',
    0.55,
    0.10::numeric(4,3),
    0.055,  -- 0.55 × 0.10
    '{"note": "SYNTHETIC — illustrative only; coarse GRACE-derived negative TWS anomaly normalised"}'::jsonb
  )
ON CONFLICT (risk_score_id, factor_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- STEP 5: confidence_scores — Low confidence for all demo metric rows.
-- factors jsonb follows the canonical shape from docs/11 §6.6.
-- All factor values are illustrative; score = 0.31 (below 0.50 → 'Low').
-- Weighted geometric mean: 0.31^0.20 × 0.25^0.20 × 0.20^0.20 ×
--                           0.28^0.15 × 0.00^0.15 × 0.30^0.10 ≈ 0 for any
-- factor = 0; in demo we set model_validation=0.0 since no real model run,
-- giving score 0.31 (fabricated round number, clearly illustrative).
-- ---------------------------------------------------------------------------

-- Confidence for each indicator_value (one row per iv)
INSERT INTO confidence_scores (
  id,
  metric_kind,
  metric_id,
  factors,
  score,
  level
) VALUES
  (
    '55555555-0005-0005-0005-000000000001',
    'indicator_value',
    '22222222-0002-0002-0002-000000000001',  -- precip_mm
    '{
      "freshness":             {"value": 0.40, "weight": 0.20, "note": "SYNTHETIC"},
      "source_quality":        {"value": 0.80, "weight": 0.20, "note": "SYNTHETIC"},
      "spatial_coverage":      {"value": 0.55, "weight": 0.20, "note": "SYNTHETIC"},
      "temporal_completeness": {"value": 0.70, "weight": 0.15, "note": "SYNTHETIC"},
      "model_validation":      {"value": 0.00, "weight": 0.15, "note": "SYNTHETIC — no real model run"},
      "convergence":           {"value": 0.40, "weight": 0.10, "note": "SYNTHETIC"}
    }'::jsonb,
    0.310::numeric(4,3),
    'Low'::confidence_level
  ),
  (
    '55555555-0005-0005-0005-000000000002',
    'indicator_value',
    '22222222-0002-0002-0002-000000000002',  -- ndvi
    '{
      "freshness":             {"value": 0.40, "weight": 0.20, "note": "SYNTHETIC"},
      "source_quality":        {"value": 0.90, "weight": 0.20, "note": "SYNTHETIC"},
      "spatial_coverage":      {"value": 0.50, "weight": 0.20, "note": "SYNTHETIC"},
      "temporal_completeness": {"value": 0.65, "weight": 0.15, "note": "SYNTHETIC"},
      "model_validation":      {"value": 0.00, "weight": 0.15, "note": "SYNTHETIC — no real model run"},
      "convergence":           {"value": 0.35, "weight": 0.10, "note": "SYNTHETIC"}
    }'::jsonb,
    0.310::numeric(4,3),
    'Low'::confidence_level
  ),
  (
    '55555555-0005-0005-0005-000000000003',
    'indicator_value',
    '22222222-0002-0002-0002-000000000003',  -- ndwi
    '{
      "freshness":             {"value": 0.40, "weight": 0.20, "note": "SYNTHETIC"},
      "source_quality":        {"value": 0.90, "weight": 0.20, "note": "SYNTHETIC"},
      "spatial_coverage":      {"value": 0.50, "weight": 0.20, "note": "SYNTHETIC"},
      "temporal_completeness": {"value": 0.65, "weight": 0.15, "note": "SYNTHETIC"},
      "model_validation":      {"value": 0.00, "weight": 0.15, "note": "SYNTHETIC — no real model run"},
      "convergence":           {"value": 0.35, "weight": 0.10, "note": "SYNTHETIC"}
    }'::jsonb,
    0.310::numeric(4,3),
    'Low'::confidence_level
  ),
  (
    '55555555-0005-0005-0005-000000000004',
    'indicator_value',
    '22222222-0002-0002-0002-000000000004',  -- surface_water_extent_km2
    '{
      "freshness":             {"value": 0.40, "weight": 0.20, "note": "SYNTHETIC"},
      "source_quality":        {"value": 0.90, "weight": 0.20, "note": "SYNTHETIC"},
      "spatial_coverage":      {"value": 0.50, "weight": 0.20, "note": "SYNTHETIC"},
      "temporal_completeness": {"value": 0.65, "weight": 0.15, "note": "SYNTHETIC"},
      "model_validation":      {"value": 0.00, "weight": 0.15, "note": "SYNTHETIC — no real model run"},
      "convergence":           {"value": 0.35, "weight": 0.10, "note": "SYNTHETIC"}
    }'::jsonb,
    0.310::numeric(4,3),
    'Low'::confidence_level
  ),
  (
    '55555555-0005-0005-0005-000000000005',
    'indicator_value',
    '22222222-0002-0002-0002-000000000005',  -- spi_3
    '{
      "freshness":             {"value": 0.40, "weight": 0.20, "note": "SYNTHETIC"},
      "source_quality":        {"value": 0.80, "weight": 0.20, "note": "SYNTHETIC"},
      "spatial_coverage":      {"value": 0.55, "weight": 0.20, "note": "SYNTHETIC"},
      "temporal_completeness": {"value": 0.70, "weight": 0.15, "note": "SYNTHETIC"},
      "model_validation":      {"value": 0.00, "weight": 0.15, "note": "SYNTHETIC — no real model run"},
      "convergence":           {"value": 0.40, "weight": 0.10, "note": "SYNTHETIC"}
    }'::jsonb,
    0.310::numeric(4,3),
    'Low'::confidence_level
  ),
  (
    '55555555-0005-0005-0005-000000000006',
    'indicator_value',
    '22222222-0002-0002-0002-000000000006',  -- irrigated_area_ha
    '{
      "freshness":             {"value": 0.40, "weight": 0.20, "note": "SYNTHETIC"},
      "source_quality":        {"value": 0.90, "weight": 0.20, "note": "SYNTHETIC"},
      "spatial_coverage":      {"value": 0.45, "weight": 0.20, "note": "SYNTHETIC"},
      "temporal_completeness": {"value": 0.60, "weight": 0.15, "note": "SYNTHETIC"},
      "model_validation":      {"value": 0.00, "weight": 0.15, "note": "SYNTHETIC — no real model run"},
      "convergence":           {"value": 0.30, "weight": 0.10, "note": "SYNTHETIC"}
    }'::jsonb,
    0.310::numeric(4,3),
    'Low'::confidence_level
  ),
  (
    '55555555-0005-0005-0005-000000000007',
    'indicator_value',
    '22222222-0002-0002-0002-000000000007',  -- abstraction_estimate_mcm
    '{
      "freshness":             {"value": 0.40, "weight": 0.20, "note": "SYNTHETIC"},
      "source_quality":        {"value": 0.70, "weight": 0.20, "note": "SYNTHETIC"},
      "spatial_coverage":      {"value": 0.45, "weight": 0.20, "note": "SYNTHETIC"},
      "temporal_completeness": {"value": 0.60, "weight": 0.15, "note": "SYNTHETIC"},
      "model_validation":      {"value": 0.00, "weight": 0.15, "note": "SYNTHETIC — no real model run"},
      "convergence":           {"value": 0.30, "weight": 0.10, "note": "SYNTHETIC"}
    }'::jsonb,
    0.310::numeric(4,3),
    'Low'::confidence_level
  ),
  (
    '55555555-0005-0005-0005-000000000008',
    'indicator_value',
    '22222222-0002-0002-0002-000000000008',  -- water_balance_mcm
    '{
      "freshness":             {"value": 0.40, "weight": 0.20, "note": "SYNTHETIC"},
      "source_quality":        {"value": 0.70, "weight": 0.20, "note": "SYNTHETIC"},
      "spatial_coverage":      {"value": 0.45, "weight": 0.20, "note": "SYNTHETIC"},
      "temporal_completeness": {"value": 0.60, "weight": 0.15, "note": "SYNTHETIC"},
      "model_validation":      {"value": 0.00, "weight": 0.15, "note": "SYNTHETIC — no real model run"},
      "convergence":           {"value": 0.30, "weight": 0.10, "note": "SYNTHETIC"}
    }'::jsonb,
    0.310::numeric(4,3),
    'Low'::confidence_level
  ),
  -- Confidence for the risk_score row
  (
    '55555555-0005-0005-0005-000000000009',
    'risk_score',
    '33333333-0003-0003-0003-000000000001',
    '{
      "freshness":             {"value": 0.40, "weight": 0.20, "note": "SYNTHETIC"},
      "source_quality":        {"value": 0.75, "weight": 0.20, "note": "SYNTHETIC"},
      "spatial_coverage":      {"value": 0.50, "weight": 0.20, "note": "SYNTHETIC"},
      "temporal_completeness": {"value": 0.65, "weight": 0.15, "note": "SYNTHETIC"},
      "model_validation":      {"value": 0.00, "weight": 0.15, "note": "SYNTHETIC — no real model validation run"},
      "convergence":           {"value": 0.35, "weight": 0.10, "note": "SYNTHETIC"}
    }'::jsonb,
    0.310::numeric(4,3),
    'Low'::confidence_level
  )
ON CONFLICT (metric_kind, metric_id) DO NOTHING;

COMMIT;

-- =============================================================================
-- End of 0011_seed_demo_ILLUSTRATIVE.sql
-- =============================================================================
-- Verification query (run manually after applying):
--
-- SELECT iv.obs_date, i.code, iv.value, i.unit,
--        p.source, cs.level AS confidence_level
-- FROM indicator_values iv
-- JOIN indicators i ON i.id = iv.indicator_id
-- JOIN provenance p ON p.id = iv.provenance_id
-- LEFT JOIN confidence_scores cs ON cs.metric_kind='indicator_value' AND cs.metric_id=iv.id
-- JOIN regions r ON r.id = iv.region_id AND r.code = 'azraq_basin'
-- ORDER BY i.code;
-- =============================================================================
