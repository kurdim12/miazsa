-- =============================================================================
-- 0002_enums.sql
-- MIZAN — Phase 2 Enumerations
-- All seven domain enums, guarded with DO blocks so migration is idempotent.
-- Source of truth: docs/11-database-schema.md §3
-- =============================================================================

-- 1. user_role — application user roles (drives JWT claims + RLS).
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('viewer', 'analyst', 'admin', 'judge');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. gw_stress_class — groundwater stress classification bins (0-100 index).
DO $$ BEGIN
  CREATE TYPE gw_stress_class AS ENUM ('Low', 'Moderate', 'High', 'Severe');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. confidence_level — band derived from weighted geometric-mean score.
DO $$ BEGIN
  CREATE TYPE confidence_level AS ENUM ('High', 'Medium', 'Low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. region_kind — spatial unit category.
DO $$ BEGIN
  CREATE TYPE region_kind AS ENUM ('basin', 'governorate', 'district', 'aoi', 'country');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. metric_kind — which fact table a confidence_score / provenance refers to.
DO $$ BEGIN
  CREATE TYPE metric_kind AS ENUM (
    'indicator_value',
    'prediction',
    'risk_score',
    'scenario_result'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. alert_severity — severity of an environmental alert.
DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('info', 'watch', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. job_status — lifecycle state for reports, scenarios, model_runs.
DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'pending',
    'running',
    'succeeded',
    'failed',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
