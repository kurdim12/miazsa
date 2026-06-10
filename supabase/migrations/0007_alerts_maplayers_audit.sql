-- =============================================================================
-- 0007_alerts_maplayers_audit.sql
-- MIZAN — Phase 2 Alerts, Map Layers & Audit Log
-- Creates: alerts, map_layers, audit_log
-- Source of truth: docs/11-database-schema.md §7.6–7.8
-- =============================================================================

-- ---------------------------------------------------------------------------
-- alerts
-- Environmental alerts raised by rule evaluation against latest metrics.
-- Distinct from platform/ops alerts; region-scoped and indicator-linked.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id       uuid            NOT NULL REFERENCES regions(id),
  indicator_id    uuid            REFERENCES indicators(id),
  severity        alert_severity  NOT NULL DEFAULT 'info',
  title           text            NOT NULL,
  message         text,
  triggered_value double precision,
  threshold       double precision,
  triggered_at    timestamptz     NOT NULL DEFAULT now(),
  acknowledged    boolean         NOT NULL DEFAULT false,
  acknowledged_by uuid            REFERENCES auth.users(id),
  provenance_id   uuid            REFERENCES provenance(id),
  created_at      timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_region_idx   ON alerts (region_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS alerts_severity_idx ON alerts (severity);

-- ---------------------------------------------------------------------------
-- map_layers
-- Catalog of renderable layers (EE getMapId templates or pre-exported COGs).
-- Consumed by the tiles Edge Function and the React map UI.
-- vis_params / legend are jsonb for flexibility (palette, min/max, bands).
-- bounds geometry(Polygon,4326) for spatial filtering of visible layers.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS map_layers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text        UNIQUE NOT NULL,
  title_en     text        NOT NULL,
  title_ar     text,
  region_id    uuid        REFERENCES regions(id),
  indicator_id uuid        REFERENCES indicators(id),
  layer_type   text        NOT NULL CHECK (layer_type IN ('ee_getmapid', 'cog', 'vector')),
  source_uri   text,
  vis_params   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  legend       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  bounds       geometry(Polygon, 4326),
  version      integer     NOT NULL DEFAULT 1,
  provenance_id uuid       REFERENCES provenance(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS map_layers_bounds_gix  ON map_layers USING GIST (bounds);
CREATE INDEX IF NOT EXISTS map_layers_region_idx  ON map_layers (region_id);

-- ---------------------------------------------------------------------------
-- audit_log
-- In-database action trail (docs/11 §7.8, docs/17 §2.3, §6.6).
-- Append-only by design: no UPDATE or DELETE RLS policies are ever created.
-- actor: user id / service account / function name.
-- action: e.g. 'indicator_insert', 'model_run_trigger', 'user_role_change',
--         'report_generate', 'scenario_run', 'secret_rotation', 'login',
--         'export_data', 'rls_violation_attempt'.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor       text,
  action      text        NOT NULL,
  target_kind text,
  target_id   uuid,
  detail      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_action_idx ON audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_target_idx ON audit_log (target_kind, target_id);
