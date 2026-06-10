-- =============================================================================
-- 0001_init_extensions.sql
-- MIZAN — Phase 2 Database Bootstrap
-- Enable required PostgreSQL extensions (idempotent).
-- =============================================================================

-- PostGIS: spatial types, functions, GIST operator classes.
CREATE EXTENSION IF NOT EXISTS postgis;

-- pgcrypto: gen_random_uuid() for UUID primary keys.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- uuid-ossp: fallback UUID generation (provides uuid_generate_v4()).
-- Kept alongside pgcrypto for compatibility with any tooling that calls it.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm: trigram similarity for text search on region/indicator names.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- btree_gist: allows GIST indexes on btree-type columns (needed for exclusion
-- constraints over temporal ranges if added later).
CREATE EXTENSION IF NOT EXISTS btree_gist;
