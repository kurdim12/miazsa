-- =============================================================================
-- 0010_views.sql
-- MIZAN — Phase 2 Views & Materialized Views
-- Creates:
--   mv_latest_indicator   — latest indicator value per region × indicator
--   mv_latest_risk        — latest risk score per region
--   v_latest_indicator    — regular view alias (no REFRESH needed by caller)
--   v_latest_risk         — regular view alias
--   v_metric_envelope     — full validation envelope per indicator_value
--                           (Source / Date / Methodology / Confidence / Explanation)
-- Source of truth: docs/11-database-schema.md §12
-- =============================================================================

-- ---------------------------------------------------------------------------
-- mv_latest_indicator
-- Materialized view: one row per (region_id, indicator_id) with the most
-- recent obs_date. Refreshed by the EE Worker / Edge Function after each
-- indicator_values insert batch.
-- UNIQUE index on (region_id, indicator_id) allows CONCURRENTLY refresh.
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_latest_indicator AS
SELECT DISTINCT ON (region_id, indicator_id)
  region_id,
  indicator_id,
  obs_date,
  value,
  confidence,
  provenance_id
FROM indicator_values
ORDER BY region_id, indicator_id, obs_date DESC;

CREATE UNIQUE INDEX IF NOT EXISTS mv_latest_indicator_uq
  ON mv_latest_indicator (region_id, indicator_id);

-- ---------------------------------------------------------------------------
-- mv_latest_risk
-- Materialized view: one row per region with the most recent risk score.
-- UNIQUE index on region_id allows CONCURRENTLY refresh.
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_latest_risk AS
SELECT DISTINCT ON (region_id)
  region_id,
  period_end,
  gw_stress_index,
  gw_stress_class,
  components,
  confidence,
  provenance_id
FROM risk_scores
ORDER BY region_id, period_end DESC;

CREATE UNIQUE INDEX IF NOT EXISTS mv_latest_risk_uq
  ON mv_latest_risk (region_id);

-- ---------------------------------------------------------------------------
-- v_latest_indicator
-- Regular (non-materialized) view that reads directly from indicator_values.
-- Exposed to PostgREST for lightweight/always-fresh queries; for performance
-- under load the caller can use mv_latest_indicator instead.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_latest_indicator AS
SELECT DISTINCT ON (iv.region_id, iv.indicator_id)
  iv.id                AS indicator_value_id,
  iv.region_id,
  r.code               AS region_code,
  r.name_en            AS region_name_en,
  iv.indicator_id,
  i.code               AS indicator_code,
  i.name_en            AS indicator_name_en,
  i.unit,
  iv.obs_date,
  iv.value,
  iv.confidence,
  iv.provenance_id,
  iv.created_at
FROM indicator_values iv
JOIN regions    r ON r.id = iv.region_id
JOIN indicators i ON i.id = iv.indicator_id
ORDER BY iv.region_id, iv.indicator_id, iv.obs_date DESC;

-- ---------------------------------------------------------------------------
-- v_latest_risk
-- Regular view: latest risk score per region with class label.
-- Joins regions for name resolution.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_latest_risk AS
SELECT DISTINCT ON (rs.region_id)
  rs.id                AS risk_score_id,
  rs.region_id,
  r.code               AS region_code,
  r.name_en            AS region_name_en,
  rs.period_start,
  rs.period_end,
  rs.gw_stress_index,
  rs.gw_stress_class,
  rs.components,
  rs.confidence,
  rs.provenance_id,
  rs.created_at
FROM risk_scores rs
JOIN regions r ON r.id = rs.region_id
ORDER BY rs.region_id, rs.period_end DESC;

-- ---------------------------------------------------------------------------
-- v_metric_envelope
-- The "Validation Envelope" view (docs/11 §13c): every indicator_value row
-- joined to its full provenance + dataset attribution + confidence score.
-- Columns follow the docs/11 §8 envelope: Source / Date / Methodology /
-- Confidence / Explanation.
--
-- Used by:
--   - PostgREST: GET /rest/v1/v_metric_envelope?indicator_value_id=eq.<uuid>
--   - Edge Function ai-insights: provides grounded data context
--   - Report generator: cites source + confidence per indicator claim
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_metric_envelope AS
SELECT
  -- ── Metric identity ───────────────────────────────────────────────────────
  iv.id                         AS indicator_value_id,
  iv.region_id,
  r.code                        AS region_code,
  r.name_en                     AS region_name_en,
  iv.indicator_id,
  i.code                        AS indicator_code,
  i.name_en                     AS indicator_name_en,
  i.unit                        AS indicator_unit,
  i.category                    AS indicator_category,
  iv.obs_date,
  iv.value,

  -- ── Source (provenance spine) ─────────────────────────────────────────────
  p.id                          AS provenance_id,
  p.source                      AS source,
  p.ee_asset_id                 AS ee_asset_id,
  p.period_start                AS source_period_start,
  p.period_end                  AS source_period_end,
  p.computed_by                 AS computed_by,
  p.created_at                  AS provenance_created_at,

  -- ── Methodology ───────────────────────────────────────────────────────────
  p.processing_method           AS methodology,
  p.processing_version          AS pipeline_version,
  p.parameters                  AS processing_parameters,

  -- ── Dataset attribution ───────────────────────────────────────────────────
  d.id                          AS dataset_id,
  d.key                         AS dataset_key,
  d.name                        AS dataset_name,
  d.provider                    AS dataset_provider,
  d.attribution                 AS dataset_attribution,
  d.license                     AS dataset_license,
  d.temporal_res                AS dataset_temporal_res,
  d.source_quality              AS dataset_source_quality,

  -- ── Model linkage (when value is model-derived) ───────────────────────────
  mr.id                         AS model_run_id,
  mr.version                    AS model_run_version,
  mr.validation_score           AS model_validation_score,
  m.key                         AS model_key,
  m.name                        AS model_name,
  m.kind                        AS model_kind,
  m.framework                   AS model_framework,

  -- ── Confidence (authoritative six-factor score) ───────────────────────────
  cs.id                         AS confidence_score_id,
  cs.score                      AS confidence_score,
  cs.level                      AS confidence_level,
  cs.factors                    AS confidence_factors,
  cs.computed_at                AS confidence_computed_at,

  -- ── Denormalized confidence on iv row (fast read) ─────────────────────────
  iv.confidence                 AS confidence_denorm,

  iv.created_at                 AS value_created_at

FROM indicator_values iv
JOIN regions       r  ON r.id  = iv.region_id
JOIN indicators    i  ON i.id  = iv.indicator_id
JOIN provenance    p  ON p.id  = iv.provenance_id
LEFT JOIN datasets d  ON d.id  = p.dataset_id
LEFT JOIN model_runs mr ON mr.id = p.model_run_id
LEFT JOIN models    m  ON m.id  = mr.model_id
LEFT JOIN confidence_scores cs
       ON cs.metric_kind = 'indicator_value'
      AND cs.metric_id   = iv.id;
