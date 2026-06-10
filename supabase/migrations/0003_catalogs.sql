-- =============================================================================
-- 0003_catalogs.sql
-- MIZAN — Phase 2 Catalog & Spatial Tables
-- Creates: datasets, indicators, regions, public.profiles
-- Source of truth: docs/11-database-schema.md §4
-- All timestamps UTC; geometries SRID 4326; GIST on geom columns.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- public.profiles
-- Extends auth.users with the application role and display metadata.
-- Note: auth.users is Supabase-managed; this table hangs off it via FK.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         user_role   NOT NULL DEFAULT 'viewer',
  full_name    text,
  organization text,
  locale       text        NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Trigger: keep updated_at current on profiles.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- regions
-- Spatial units of analysis: basins, governorates, districts, AOIs, country.
-- Self-referential hierarchy via parent_id.
-- geom is MultiPolygon to accommodate complex basin / country outlines.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regions (
  id          uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text                        UNIQUE,
  name_en     text                        NOT NULL,
  name_ar     text,
  kind        region_kind                 NOT NULL,
  parent_id   uuid                        REFERENCES regions(id),
  admin_level smallint,
  source      text,
  area_km2    double precision,
  geom        geometry(MultiPolygon, 4326) NOT NULL,
  created_at  timestamptz                 NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regions_geom_gix   ON regions USING GIST (geom);
CREATE INDEX IF NOT EXISTS regions_kind_idx   ON regions (kind);
CREATE INDEX IF NOT EXISTS regions_parent_idx ON regions (parent_id);

-- ---------------------------------------------------------------------------
-- datasets
-- Catalog of every EO / geospatial source referenced by provenance.
-- source_quality in [0,1] feeds the confidence engine (docs/09).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS datasets (
  id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  key                      text         UNIQUE NOT NULL,
  name                     text         NOT NULL,
  provider                 text         NOT NULL,
  ee_asset_id              text,
  spatial_res_m            double precision,
  temporal_res             text,
  latency                  text,
  license                  text         NOT NULL,
  attribution              text         NOT NULL,
  freshness_threshold_days integer,
  source_quality           numeric(3,2) CHECK (source_quality BETWEEN 0 AND 1),
  notes                    text,
  created_at               timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS datasets_key_idx ON datasets (key);

-- ---------------------------------------------------------------------------
-- indicators
-- Catalog of canonical indicator codes, units, and descriptions.
-- value_min / value_max define the expected valid range (nullable).
-- unit values are open-ended text (not an enum), per docs/11 §3 note.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indicators (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        UNIQUE NOT NULL,
  name_en     text        NOT NULL,
  name_ar     text,
  unit        text        NOT NULL,
  category    text,
  value_min   double precision,
  value_max   double precision,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS indicators_category_idx ON indicators (category);
