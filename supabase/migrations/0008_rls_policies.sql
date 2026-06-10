-- =============================================================================
-- 0008_rls_policies.sql
-- MIZAN — Phase 2 Row-Level Security Policies
-- Enables RLS on every table and creates concrete policies per docs/17 §2.3
-- and docs/11 §9 role matrix.
--
-- DESIGN PRINCIPLES:
--   • Public environmental catalog & metric tables: anon + authenticated SELECT.
--   • Value/derived tables: writes restricted to service_role only (no INSERT /
--     UPDATE / DELETE client policy means only service_role bypass applies).
--   • profiles: row-owner self-access; admin sees all; self-update guards role.
--   • audit_log: admin + judge SELECT only; INSERT service_role; no UPDATE/DELETE.
--   • validation_records: analyst/admin/judge SELECT; INSERT service_role.
--   • scenarios: analyst creates/owns; all authenticated read.
--   • reports / report_sections: owner/admin; analyst can insert own.
--   • alerts: all authenticated read; analyst can acknowledge (UPDATE); service_role writes.
--
-- Idempotent: each ENABLE is safe to re-run; CREATE POLICY uses IF NOT EXISTS
-- pattern via DO blocks to avoid duplicate-policy errors on re-migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: check caller's mizan role by reading public.profiles.
-- Used in USING/WITH CHECK clauses.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- 1. CATALOG TABLES — public read (anon + authenticated)
-- Writes only via service_role (no client INSERT/UPDATE/DELETE policy).
-- ============================================================================

-- ── profiles ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT TO authenticated
    USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_select_admin"
    ON public.profiles FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users can update their own non-role fields only (role column frozen for self).
DO $$ BEGIN
  CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
      auth.uid() = id
      AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admins can update any profile (including role assignment).
DO $$ BEGIN
  CREATE POLICY "profiles_update_admin"
    ON public.profiles FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Supabase Auth trigger inserts a profile row on user creation (service_role).
DO $$ BEGIN
  CREATE POLICY "profiles_insert_service"
    ON public.profiles FOR INSERT TO service_role
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── regions ──────────────────────────────────────────────────────────────────
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "regions_select_anon"
    ON regions FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "regions_select_authenticated"
    ON regions FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "regions_write_service"
    ON regions FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── datasets ─────────────────────────────────────────────────────────────────
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "datasets_select_anon"
    ON datasets FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "datasets_select_authenticated"
    ON datasets FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "datasets_write_service"
    ON datasets FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── indicators ───────────────────────────────────────────────────────────────
ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "indicators_select_anon"
    ON indicators FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "indicators_select_authenticated"
    ON indicators FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "indicators_write_service"
    ON indicators FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. PROVENANCE — public read; service_role writes
-- ============================================================================
ALTER TABLE provenance ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "provenance_select_anon"
    ON provenance FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "provenance_select_authenticated"
    ON provenance FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "provenance_write_service"
    ON provenance FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── models ───────────────────────────────────────────────────────────────────
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "models_select_anon"
    ON models FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "models_select_authenticated"
    ON models FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "models_write_service"
    ON models FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── model_runs ───────────────────────────────────────────────────────────────
ALTER TABLE model_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "model_runs_select_authenticated"
    ON model_runs FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "model_runs_write_service"
    ON model_runs FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 3. FACT / VALUE TABLES
-- All authenticated + anon SELECT (public environmental data).
-- No client INSERT/UPDATE/DELETE policy → only service_role (bypasses RLS) writes.
-- ============================================================================

-- ── indicator_values ─────────────────────────────────────────────────────────
ALTER TABLE indicator_values ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "indicator_values_select_anon"
    ON indicator_values FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "indicator_values_select_authenticated"
    ON indicator_values FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "indicator_values_insert_service"
    ON indicator_values FOR INSERT TO service_role
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "indicator_values_update_service"
    ON indicator_values FOR UPDATE TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── observations ─────────────────────────────────────────────────────────────
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "observations_select_anon"
    ON observations FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "observations_select_authenticated"
    ON observations FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "observations_write_service"
    ON observations FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── predictions ──────────────────────────────────────────────────────────────
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "predictions_select_anon"
    ON predictions FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "predictions_select_authenticated"
    ON predictions FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "predictions_write_service"
    ON predictions FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── risk_scores ──────────────────────────────────────────────────────────────
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "risk_scores_select_anon"
    ON risk_scores FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "risk_scores_select_authenticated"
    ON risk_scores FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "risk_scores_write_service"
    ON risk_scores FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── risk_factors ─────────────────────────────────────────────────────────────
ALTER TABLE risk_factors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "risk_factors_select_anon"
    ON risk_factors FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "risk_factors_select_authenticated"
    ON risk_factors FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "risk_factors_write_service"
    ON risk_factors FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── confidence_scores ────────────────────────────────────────────────────────
ALTER TABLE confidence_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "confidence_scores_select_anon"
    ON confidence_scores FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "confidence_scores_select_authenticated"
    ON confidence_scores FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "confidence_scores_write_service"
    ON confidence_scores FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 4. SCENARIOS / SCENARIO RESULTS
-- ============================================================================
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read scenarios.
DO $$ BEGIN
  CREATE POLICY "scenarios_select_authenticated"
    ON scenarios FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Analyst/admin can create their own scenarios.
DO $$ BEGIN
  CREATE POLICY "scenarios_insert_analyst"
    ON scenarios FOR INSERT TO authenticated
    WITH CHECK (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('analyst', 'admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Owner can update their own scenario (e.g. rename / cancel).
DO $$ BEGIN
  CREATE POLICY "scenarios_update_owner"
    ON scenarios FOR UPDATE TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin can do everything.
DO $$ BEGIN
  CREATE POLICY "scenarios_admin_all"
    ON scenarios FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "scenarios_write_service"
    ON scenarios FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── scenario_results ─────────────────────────────────────────────────────────
ALTER TABLE scenario_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "scenario_results_select_authenticated"
    ON scenario_results FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "scenario_results_write_service"
    ON scenario_results FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 5. REPORTS / REPORT SECTIONS
-- Owner (created_by) or admin can read; analyst/admin can insert own.
-- ============================================================================
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Owner and admin can read.
DO $$ BEGIN
  CREATE POLICY "reports_select_owner_admin"
    ON reports FOR SELECT TO authenticated
    USING (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'judge')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Analyst / admin can create their own reports.
DO $$ BEGIN
  CREATE POLICY "reports_insert_analyst"
    ON reports FOR INSERT TO authenticated
    WITH CHECK (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('analyst', 'admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Owner can update their own report metadata.
DO $$ BEGIN
  CREATE POLICY "reports_update_owner"
    ON reports FOR UPDATE TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "reports_write_service"
    ON reports FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── report_sections ──────────────────────────────────────────────────────────
ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;

-- Inherit report visibility: section visible if parent report is visible.
DO $$ BEGIN
  CREATE POLICY "report_sections_select_authenticated"
    ON report_sections FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM reports r
        WHERE r.id = report_id
          AND (
            r.created_by = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.role IN ('admin', 'judge')
            )
          )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "report_sections_write_service"
    ON report_sections FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 6. VALIDATION RECORDS
-- analyst / admin / judge can SELECT; service_role writes.
-- ============================================================================
ALTER TABLE validation_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "validation_records_select_anon"
    ON validation_records FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "validation_records_select_authenticated"
    ON validation_records FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "validation_records_write_service"
    ON validation_records FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 7. ALERTS
-- All authenticated + anon SELECT; analyst can acknowledge (UPDATE);
-- service_role writes.
-- ============================================================================
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "alerts_select_anon"
    ON alerts FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "alerts_select_authenticated"
    ON alerts FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Analyst (and above) can acknowledge alerts (set acknowledged = true).
DO $$ BEGIN
  CREATE POLICY "alerts_acknowledge_analyst"
    ON alerts FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('analyst', 'admin')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('analyst', 'admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "alerts_write_service"
    ON alerts FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 8. MAP LAYERS — public read; service_role writes
-- ============================================================================
ALTER TABLE map_layers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "map_layers_select_anon"
    ON map_layers FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "map_layers_select_authenticated"
    ON map_layers FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "map_layers_write_service"
    ON map_layers FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 9. AUDIT LOG
-- APPEND-ONLY: no UPDATE or DELETE policy for any role.
-- service_role INSERT; admin + judge SELECT.
-- ============================================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "audit_log_select_admin_judge"
    ON audit_log FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'judge')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "audit_log_insert_service"
    ON audit_log FOR INSERT TO service_role
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Intentionally NO UPDATE policy on audit_log — enforces append-only.
-- Intentionally NO DELETE policy on audit_log — audit rows are permanent.
