-- =============================================================================
-- 0004_provenance_models.sql
-- MIZAN — Phase 2 Provenance, Models & Model Runs
-- Creates: provenance (without deferred FK first), models, model_runs,
--          then adds provenance.model_run_id FK once model_runs exists.
-- Source of truth: docs/11-database-schema.md §5
-- Ordering: extensions → enums → catalogs → THIS file → fact tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- provenance
-- Traceability spine. Every computed value references exactly one row here.
-- model_run_id FK is added AFTER model_runs to satisfy ordering constraint.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provenance (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source             text        NOT NULL,
  dataset_id         uuid        REFERENCES datasets(id),
  ee_asset_id        text,
  period_start       date,
  period_end         date,
  processing_method  text        NOT NULL,
  processing_version text        NOT NULL,
  parameters         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  model_run_id       uuid,       -- FK wired below after model_runs is created
  computed_by        text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provenance_dataset_idx  ON provenance (dataset_id);
CREATE INDEX IF NOT EXISTS provenance_period_idx   ON provenance (period_start, period_end);
CREATE INDEX IF NOT EXISTS provenance_params_gin   ON provenance USING GIN (parameters);

-- ---------------------------------------------------------------------------
-- models
-- Registry of analytical models (the MODEL REGISTRY from the contract).
-- Seeded in 0009_seed_catalogs.sql with the six canonical model keys.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS models (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        UNIQUE NOT NULL,
  name        text        NOT NULL,
  kind        text,
  framework   text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- model_runs
-- A specific execution / version of a model with validation metrics.
-- validation_score [0,1] feeds the confidence model_validation factor.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS model_runs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id         uuid        NOT NULL REFERENCES models(id),
  version          text        NOT NULL,
  status           job_status  NOT NULL DEFAULT 'pending',
  trained_at       timestamptz,
  metrics          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  validation_score numeric(4,3) CHECK (validation_score BETWEEN 0 AND 1),
  hyperparameters  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  artifact_uri     text,
  created_by       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_runs_model_idx ON model_runs (model_id);

-- ---------------------------------------------------------------------------
-- Deferred FK: provenance.model_run_id → model_runs(id)
-- Added now that model_runs exists (idempotent via DO block).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provenance_model_run_fk'
  ) THEN
    ALTER TABLE provenance
      ADD CONSTRAINT provenance_model_run_fk
      FOREIGN KEY (model_run_id) REFERENCES model_runs(id);
  END IF;
END $$;
