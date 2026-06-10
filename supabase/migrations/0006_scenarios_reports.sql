-- =============================================================================
-- 0006_scenarios_reports.sql
-- MIZAN — Phase 2 Scenarios, Reports & Validation
-- Creates: scenarios, scenario_results, reports, report_sections,
--          validation_records
-- Source of truth: docs/11-database-schema.md §7.1–7.5
-- =============================================================================

-- ---------------------------------------------------------------------------
-- scenarios
-- What-if scenario definitions. params jsonb carries delta inputs, e.g.
-- {"irrigated_area_pct": 15, "precip_pct": -20}.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scenarios (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id   uuid        NOT NULL REFERENCES regions(id),
  name        text        NOT NULL,
  description text,
  params      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by  uuid        REFERENCES auth.users(id),
  status      job_status  NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scenarios_region_idx ON scenarios (region_id);

-- ---------------------------------------------------------------------------
-- scenario_results
-- Modeled output of a scenario run. Clearly "what-if"; NOT NULL provenance.
-- delta_vs_baseline jsonb records component-level deltas from the baseline.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scenario_results (
  id                uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id       uuid            NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  gw_stress_index   numeric(5,2)    NOT NULL CHECK (gw_stress_index BETWEEN 0 AND 100),
  gw_stress_class   gw_stress_class NOT NULL,
  components        jsonb           NOT NULL DEFAULT '{}'::jsonb,
  delta_vs_baseline jsonb           NOT NULL DEFAULT '{}'::jsonb,
  confidence        numeric(4,3)    CHECK (confidence BETWEEN 0 AND 1),
  provenance_id     uuid            NOT NULL REFERENCES provenance(id),
  created_at        timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sr_scenario_idx ON scenario_results (scenario_id);

-- ---------------------------------------------------------------------------
-- reports
-- Generated assessment reports (PDF stored in Supabase Storage).
-- created_by FK links to auth.users for ownership/RLS scoping.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id    uuid        REFERENCES regions(id),
  title        text        NOT NULL,
  period_start date,
  period_end   date,
  lang         text        NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'ar')),
  status       job_status  NOT NULL DEFAULT 'pending',
  storage_path text,
  summary      text,
  created_by   uuid        REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_region_idx ON reports (region_id);

-- ---------------------------------------------------------------------------
-- report_sections
-- Sections within a report; ordinal is unique per report.
-- figures jsonb: array of figure references (tile/COG snapshots).
-- sources jsonb: array of provenance_ids cited in this section.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_sections (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  uuid        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  ordinal    integer     NOT NULL,
  heading    text        NOT NULL,
  body       text,
  figures    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  sources    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, ordinal)
);

CREATE INDEX IF NOT EXISTS report_sections_report_idx ON report_sections (report_id);

-- ---------------------------------------------------------------------------
-- validation_records
-- Ground-truth / cross-validation evidence for the validation framework.
-- method: 'cross_sensor' | 'field_reference' | 'holdout' | etc.
-- Polymorphic (metric_kind, metric_id); provenance link optional.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS validation_records (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_kind      metric_kind,
  metric_id        uuid,
  method           text        NOT NULL,
  reference_source text,
  observed         double precision,
  predicted        double precision,
  error            double precision,
  passed           boolean,
  notes            text,
  provenance_id    uuid        REFERENCES provenance(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vr_metric_idx ON validation_records (metric_kind, metric_id);
