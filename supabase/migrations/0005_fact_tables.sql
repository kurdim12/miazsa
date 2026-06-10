-- =============================================================================
-- 0005_fact_tables.sql
-- MIZAN — Phase 2 Fact / Value Tables
-- Creates: indicator_values, observations, predictions, risk_scores,
--          risk_factors, confidence_scores
-- ALL value-bearing tables carry NOT NULL provenance_id (core invariant).
-- Source of truth: docs/11-database-schema.md §6
-- =============================================================================

-- ---------------------------------------------------------------------------
-- indicator_values
-- Core time-series fact: one row per region × indicator × date.
-- Hot read path: (region_id, indicator_id, obs_date DESC) composite index.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indicator_values (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id     uuid         NOT NULL REFERENCES regions(id),
  indicator_id  uuid         NOT NULL REFERENCES indicators(id),
  obs_date      date         NOT NULL,
  value         double precision NOT NULL,
  confidence    numeric(4,3) CHECK (confidence BETWEEN 0 AND 1),
  provenance_id uuid         NOT NULL REFERENCES provenance(id),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (region_id, indicator_id, obs_date, provenance_id)
);

-- Hot read path: time series per region + indicator.
CREATE INDEX IF NOT EXISTS iv_region_indicator_date_idx
  ON indicator_values (region_id, indicator_id, obs_date DESC);

CREATE INDEX IF NOT EXISTS iv_indicator_date_idx
  ON indicator_values (indicator_id, obs_date DESC);

CREATE INDEX IF NOT EXISTS iv_provenance_idx
  ON indicator_values (provenance_id);

-- ---------------------------------------------------------------------------
-- observations
-- Lower-level / raw reduced observations (per-scene zonal stats).
-- valid_pixel_fraction feeds the confidence spatial_coverage factor.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS observations (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id            uuid         NOT NULL REFERENCES regions(id),
  indicator_id         uuid         REFERENCES indicators(id),
  dataset_id           uuid         REFERENCES datasets(id),
  obs_time             timestamptz  NOT NULL,
  value                double precision,
  valid_pixel_fraction numeric(4,3) CHECK (valid_pixel_fraction BETWEEN 0 AND 1),
  raw                  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  provenance_id        uuid         NOT NULL REFERENCES provenance(id),
  created_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obs_region_time_idx ON observations (region_id, obs_time DESC);
CREATE INDEX IF NOT EXISTS obs_dataset_idx     ON observations (dataset_id);

-- ---------------------------------------------------------------------------
-- predictions
-- Model outputs (class / value + probability + SHAP attributions).
-- region_id OR geom must be non-null (CHECK constraint enforces this).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS predictions (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id     uuid         REFERENCES regions(id),
  geom          geometry(Geometry, 4326),
  model_id      uuid         NOT NULL REFERENCES models(id),
  model_run_id  uuid         REFERENCES model_runs(id),
  indicator_id  uuid         REFERENCES indicators(id),
  pred_date     date         NOT NULL,
  value         double precision,
  class         text,
  probability   numeric(4,3) CHECK (probability BETWEEN 0 AND 1),
  shap          jsonb        NOT NULL DEFAULT '{}'::jsonb,
  confidence    numeric(4,3) CHECK (confidence BETWEEN 0 AND 1),
  provenance_id uuid         NOT NULL REFERENCES provenance(id),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  CHECK (region_id IS NOT NULL OR geom IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS pred_geom_gix        ON predictions USING GIST (geom);
CREATE INDEX IF NOT EXISTS pred_region_date_idx ON predictions (region_id, pred_date DESC);
CREATE INDEX IF NOT EXISTS pred_model_idx       ON predictions (model_id);

-- ---------------------------------------------------------------------------
-- risk_scores
-- Headline groundwater-stress result per region × period.
-- components jsonb canonical shape (docs/11 §6.4):
--   {
--     "abstraction_pressure":   {"value": 0.0, "weight": 0.30},
--     "recharge_deficit":       {"value": 0.0, "weight": 0.25},
--     "veg_water_divergence":   {"value": 0.0, "weight": 0.20},
--     "surface_water_decline":  {"value": 0.0, "weight": 0.15},
--     "regional_storage_grace": {"value": 0.0, "weight": 0.10}
--   }
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS risk_scores (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id       uuid            NOT NULL REFERENCES regions(id),
  period_start    date            NOT NULL,
  period_end      date            NOT NULL,
  gw_stress_index numeric(5,2)    NOT NULL CHECK (gw_stress_index BETWEEN 0 AND 100),
  gw_stress_class gw_stress_class NOT NULL,
  components      jsonb           NOT NULL DEFAULT '{}'::jsonb,
  confidence      numeric(4,3)    CHECK (confidence BETWEEN 0 AND 1),
  provenance_id   uuid            NOT NULL REFERENCES provenance(id),
  created_at      timestamptz     NOT NULL DEFAULT now(),
  UNIQUE (region_id, period_start, period_end, provenance_id)
);

CREATE INDEX IF NOT EXISTS rs_region_period_idx ON risk_scores (region_id, period_end DESC);
CREATE INDEX IF NOT EXISTS rs_class_idx         ON risk_scores (gw_stress_class);
CREATE INDEX IF NOT EXISTS rs_components_gin    ON risk_scores USING GIN (components);

-- ---------------------------------------------------------------------------
-- risk_factors
-- Normalized, queryable breakdown of each risk component.
-- One row per component per risk_score; complements components jsonb.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS risk_factors (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_score_id  uuid         NOT NULL REFERENCES risk_scores(id) ON DELETE CASCADE,
  factor_key     text         NOT NULL,
  factor_value   double precision NOT NULL,
  weight         numeric(4,3) NOT NULL CHECK (weight BETWEEN 0 AND 1),
  weighted_value double precision NOT NULL,
  detail         jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (risk_score_id, factor_key)
);

CREATE INDEX IF NOT EXISTS rf_risk_score_idx ON risk_factors (risk_score_id);

-- ---------------------------------------------------------------------------
-- confidence_scores
-- Authoritative confidence per metric: six-factor weighted geometric mean.
-- Polymorphic reference via (metric_kind, metric_id) — no multi-parent FK.
-- factors jsonb canonical shape (docs/11 §6.6):
--   {
--     "freshness":             {"value": 0.0, "weight": 0.20},
--     "source_quality":        {"value": 0.0, "weight": 0.20},
--     "spatial_coverage":      {"value": 0.0, "weight": 0.20},
--     "temporal_completeness": {"value": 0.0, "weight": 0.15},
--     "model_validation":      {"value": 0.0, "weight": 0.15},
--     "convergence":           {"value": 0.0, "weight": 0.10}
--   }
-- Polymorphic integrity enforced by write-path Edge Function + trigger.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS confidence_scores (
  id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_kind metric_kind      NOT NULL,
  metric_id   uuid             NOT NULL,
  factors     jsonb            NOT NULL DEFAULT '{}'::jsonb,
  score       numeric(4,3)     NOT NULL CHECK (score BETWEEN 0 AND 1),
  level       confidence_level NOT NULL,
  computed_at timestamptz      NOT NULL DEFAULT now(),
  UNIQUE (metric_kind, metric_id)
);

CREATE INDEX IF NOT EXISTS cs_metric_idx   ON confidence_scores (metric_kind, metric_id);
CREATE INDEX IF NOT EXISTS cs_factors_gin  ON confidence_scores USING GIN (factors);
