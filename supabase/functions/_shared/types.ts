// =============================================================================
// _shared/types.ts — Shared TypeScript types for MIZAN Phase-2 Edge Functions
//
// Source of truth:
//   - docs/12-api-specification.md §1.6 (envelope), §1.7 (errors), §3.1/§3.2/§3.6
//   - docs/11-database-schema.md (enums + column shapes)
//   - docs/08-risk-scoring.md (risk components)
//   - docs/09-confidence-engine.md (confidence factors)
//
// These types describe the *wire* contract (what crosses the HTTP boundary) and
// the small subset of DB row shapes the functions read/write. They are kept
// deliberately self-contained so the functions typecheck without generated DB
// types being present.
// =============================================================================

// ---------------------------------------------------------------------------
// Domain enums (mirror docs/11 §3 Postgres enums).
// ---------------------------------------------------------------------------
export type UserRole = "viewer" | "analyst" | "admin" | "judge";
export type GwStressClass = "Low" | "Moderate" | "High" | "Severe";
export type ConfidenceLevel = "High" | "Medium" | "Low";
export type RegionKind = "basin" | "governorate" | "district" | "aoi" | "country";
export type MetricKind = "indicator_value" | "prediction" | "risk_score" | "scenario_result";
export type AlertSeverity = "info" | "watch" | "warning" | "critical";
export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "archived";

// ---------------------------------------------------------------------------
// Confidence factor keys (the six factors from docs/09 §2).
// ---------------------------------------------------------------------------
export type ConfidenceFactorKey =
  | "freshness"
  | "source_quality"
  | "spatial_coverage"
  | "temporal_completeness"
  | "model_validation"
  | "convergence";

/** A single confidence factor as surfaced in the envelope: {value, weight}. */
export interface ConfidenceFactor {
  value: number;
  weight: number;
}

/**
 * The set of factors in a confidence breakdown, stored as {value, weight} per
 * factor. For indicator/metric confidence the keys are the six docs/09 factors
 * (see ConfidenceFactorKey); for the *risk* score the keys are the five
 * sub-indices (docs/08 §6). A string-keyed map covers both and matches the
 * generic jsonb storage in confidence_scores.factors (docs/11 §6.6).
 */
export type ConfidenceFactors = Record<string, ConfidenceFactor>;

/**
 * The confidence object carried by every value-returning response
 * (docs/12 §1.6). `factors` holds the *used* factors with their renormalized
 * weights so the score is reproducible.
 */
export interface ConfidenceObject {
  score: number;
  level: ConfidenceLevel;
  factors: ConfidenceFactors;
}

// ---------------------------------------------------------------------------
// Provenance (docs/12 §1.6 / §4 schema, docs/11 §5.1).
// ---------------------------------------------------------------------------
export interface Provenance {
  id: string;
  source: string;
  dataset_id?: string | null;
  ee_asset_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  processing_method: string;
  processing_version: string;
  parameters?: Record<string, unknown>;
  model_run_id?: string | null;
  attribution?: string | null;
}

// ---------------------------------------------------------------------------
// Standard response envelope (docs/12 §1.6).
// ---------------------------------------------------------------------------
export interface EnvelopeMeta {
  request_id: string;
  generated_at: string;
  processing_version: string;
  cached: boolean;
  /** Optional honest-data note (docs/12 §1.7 — data:null + meta.note path). */
  note?: string;
  /** Optional poll hint for 202 long jobs (docs/12 §3.1). */
  poll?: string;
  [key: string]: unknown;
}

export interface Envelope<T = unknown> {
  data: T;
  provenance?: Provenance[];
  confidence?: ConfidenceObject;
  meta: EnvelopeMeta;
}

// ---------------------------------------------------------------------------
// Error model (docs/12 §1.7).
// ---------------------------------------------------------------------------
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "INTERNAL";

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    request_id: string;
  };
}

/** Resolved identity returned by getAuth(). */
export interface AuthContext {
  userId: string;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// Shared request sub-shapes.
// ---------------------------------------------------------------------------
export interface Period {
  start: string; // ISO date YYYY-MM-DD
  end: string; // ISO date YYYY-MM-DD
}

/** GeoJSON Polygon (the only AOI geometry ee-compute accepts, docs/12 §3.1). */
export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

// ---------------------------------------------------------------------------
// ee-compute (docs/12 §3.1).
// ---------------------------------------------------------------------------
export interface EeComputeOptions {
  cloud_prob_threshold?: number;
  composite?: string;
  [key: string]: unknown;
}

export interface EeComputeRequest {
  region_id?: string;
  aoi?: GeoJSONPolygon;
  indicators: string[];
  period: Period;
  options?: EeComputeOptions;
}

export interface EeComputeResultItem {
  indicator: string;
  obs_date: string;
  value: number;
  provenance_id: string;
  confidence: { score: number; level: ConfidenceLevel };
}

export interface EeComputeData {
  region_id: string;
  results: EeComputeResultItem[];
}

/** 202 async-job body (docs/12 §3.1). */
export interface EeComputeJobData {
  job_id: string;
  status: JobStatus;
}

/**
 * Shape the EE Worker returns for a *synchronous* compute
 * (POST $EE_WORKER_URL/compute). Mirrors docs/03 §5.2 (worker writes values +
 * provenance). For an async/long job it returns {job_id, status:"running"}.
 */
export interface EeWorkerResultItem {
  indicator: string;
  obs_date: string;
  value: number;
  // Per-metric confidence factor inputs the worker measured during compute.
  valid_pixel_fraction?: number; // -> spatial_coverage
  cloud_fraction?: number; // -> source_quality (optical)
  n_observations?: number; // -> temporal_completeness numerator
  n_expected?: number; // -> temporal_completeness denominator
  ee_asset_id?: string | null;
  dataset_key?: string | null; // catalog lookup for source_quality / attribution
  processing_method?: string;
  parameters?: Record<string, unknown>;
}

export interface EeWorkerResponse {
  status?: "succeeded" | "running" | "failed";
  job_id?: string;
  results?: EeWorkerResultItem[];
  error?: string;
}

// ---------------------------------------------------------------------------
// risk-score (docs/12 §3.2, docs/08).
// ---------------------------------------------------------------------------
export type RiskComponentKey =
  | "abstraction_pressure"
  | "recharge_deficit"
  | "veg_water_divergence"
  | "surface_water_decline"
  | "regional_storage_grace";

export interface RiskComponent {
  value: number; // normalized sub-index 0..100
  weight: number; // active (renormalized) weight
}

export interface RiskScoreRequest {
  region_id: string;
  period: Period;
  recompute?: boolean;
}

export interface RiskScoreData {
  region_id: string;
  period: Period;
  gw_stress_index: number;
  gw_stress_class: GwStressClass;
  components: Partial<Record<RiskComponentKey, RiskComponent>>;
}

// ---------------------------------------------------------------------------
// confidence (docs/12 §3.6).
//
// Note: docs/12 §3.6 shows the request as {metric_kind, metric_id}. The build
// brief asks for {region_id, indicator, date}. We accept BOTH forms (the
// metric-ref form is preferred and unambiguous; the descriptor form resolves
// the indicator_value row first). See confidence/index.ts.
// ---------------------------------------------------------------------------
export interface ConfidenceRequest {
  // Metric-reference form (docs/12 §3.6):
  metric_kind?: MetricKind;
  metric_id?: string;
  // Descriptor form (build brief):
  region_id?: string;
  indicator?: string;
  date?: string;
}

export interface ConfidenceData {
  metric_kind: MetricKind;
  metric_id: string;
  score: number;
  level: ConfidenceLevel;
  factors: ConfidenceFactors;
}

// ---------------------------------------------------------------------------
// Minimal DB row shapes the functions read (subset of docs/11 columns).
// ---------------------------------------------------------------------------
export interface RegionRow {
  id: string;
  code: string | null;
  name_en: string;
  kind: RegionKind;
}

export interface IndicatorRow {
  id: string;
  code: string;
  unit: string;
  category: string | null;
}

export interface DatasetRow {
  id: string;
  key: string;
  attribution: string;
  source_quality: number | null;
  freshness_threshold_days: number | null;
  ee_asset_id: string | null;
}

export interface ProvenanceRow {
  id: string;
  source: string;
  dataset_id: string | null;
  ee_asset_id: string | null;
  period_start: string | null;
  period_end: string | null;
  processing_method: string;
  processing_version: string;
  parameters: Record<string, unknown>;
  model_run_id: string | null;
}

export interface IndicatorValueRow {
  id: string;
  region_id: string;
  indicator_id: string;
  obs_date: string;
  value: number;
  confidence: number | null;
  provenance_id: string;
}

export interface ConfidenceScoreRow {
  id: string;
  metric_kind: MetricKind;
  metric_id: string;
  factors: ConfidenceFactors;
  score: number;
  level: ConfidenceLevel;
}

export interface ModelRow {
  id: string;
  key: string;
}

export interface ModelRunRow {
  id: string;
  model_id: string;
  version: string;
  validation_score: number | null;
}
