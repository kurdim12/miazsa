// =============================================================================
// src/lib/types.ts — Wire + domain types for the MIZAN web client.
//
// Source of truth:
//   - docs/12-api-specification.md §1.6 (envelope), §2 (PostgREST reads), §3 (Edge)
//   - docs/11-database-schema.md (enums + column shapes)
//   - docs/08-risk-scoring.md (risk components / sub-indices)
//   - docs/09-confidence-engine.md (confidence factors + levels)
//
// These mirror the server's _shared/types.ts so the boundary stays consistent.
// No `any` is used for envelope / provenance / confidence types (per brief).
// =============================================================================

// ---------------------------------------------------------------------------
// Domain enums (docs/11 §3).
// ---------------------------------------------------------------------------
export type UserRole = "viewer" | "analyst" | "admin" | "judge";
export type GwStressClass = "Low" | "Moderate" | "High" | "Severe";
export type ConfidenceLevel = "High" | "Medium" | "Low";
export type RegionKind = "basin" | "governorate" | "district" | "aoi" | "country";
export type MetricKind = "indicator_value" | "prediction" | "risk_score" | "scenario_result";
export type AlertSeverity = "info" | "watch" | "warning" | "critical";

// ---------------------------------------------------------------------------
// Confidence (docs/09 §2 — six factors, weighted geometric mean).
// ---------------------------------------------------------------------------
export type ConfidenceFactorKey =
  | "freshness"
  | "source_quality"
  | "spatial_coverage"
  | "temporal_completeness"
  | "model_validation"
  | "convergence";

export interface ConfidenceFactor {
  value: number;
  weight: number;
}

/** Aggregate confidence carried by every value-returning response (docs/12 §1.6). */
export interface ConfidenceObject {
  score: number;
  level: ConfidenceLevel;
  factors: Partial<Record<ConfidenceFactorKey, ConfidenceFactor>>;
}

// ---------------------------------------------------------------------------
// Provenance (docs/12 §1.6 / §4; docs/11 §5.1). `datasets` is the embedded
// catalog row PostgREST joins for attribution (provenance itself has no
// attribution column — it lives on datasets).
// ---------------------------------------------------------------------------
export interface DatasetEmbed {
  name?: string | null;
  attribution?: string | null;
}

export interface Provenance {
  id?: string;
  source: string;
  dataset_id?: string | null;
  ee_asset_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  processing_method: string;
  processing_version: string;
  parameters?: Record<string, unknown> | null;
  model_run_id?: string | null;
  /** Present on Edge envelopes; on PostgREST reads it is read via `datasets`. */
  attribution?: string | null;
  datasets?: DatasetEmbed | null;
}

// ---------------------------------------------------------------------------
// Standard response envelope (docs/12 §1.6).
// ---------------------------------------------------------------------------
export interface EnvelopeMeta {
  request_id: string;
  generated_at: string;
  processing_version: string;
  cached: boolean;
  note?: string;
  poll?: string;
  [key: string]: unknown;
}

export interface Envelope<T> {
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

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    request_id?: string;
  };
}

// ---------------------------------------------------------------------------
// Region (docs/11 §4.2 / docs/12 §2.1).
// ---------------------------------------------------------------------------
export interface Region {
  id: string;
  code: string | null;
  name_en: string;
  name_ar: string | null;
  kind: RegionKind;
  area_km2: number | null;
  /** Optional GeoJSON geometry (when fetched as GeoJSON via PostGIS helper). */
  geom?: GeoJsonGeometry | null;
}

// ---------------------------------------------------------------------------
// Indicator catalog (docs/11 §4.4).
// ---------------------------------------------------------------------------
export interface Indicator {
  id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
  unit: string;
  category: string | null;
  value_min: number | null;
  value_max: number | null;
  description: string | null;
}

// ---------------------------------------------------------------------------
// indicator_values read with embeds (docs/12 §2.3).
// confidence_scores is polymorphic (metric_kind, metric_id) and cannot be a
// PostgREST FK embed; the denormalized `confidence` numeric carries the score,
// and the factor breakdown is fetched separately when needed.
// ---------------------------------------------------------------------------
export interface IndicatorValue {
  id: string;
  region_id: string;
  indicator_id: string;
  obs_date: string;
  value: number;
  /** Denormalized aggregate confidence in [0,1] (docs/09 §6 / docs/11 §6.1). */
  confidence: number | null;
  provenance_id: string;
  provenance?: Provenance | null;
  indicators?: Indicator | null;
}

// ---------------------------------------------------------------------------
// risk_scores read with embeds (docs/12 §2.4) + risk-score Edge data (§3.2).
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

export type RiskComponents = Partial<Record<RiskComponentKey, RiskComponent>>;

export interface RiskScore {
  id?: string;
  region_id: string;
  period_start: string;
  period_end: string;
  gw_stress_index: number;
  gw_stress_class: GwStressClass;
  components: RiskComponents;
  confidence: number | null;
  provenance_id?: string;
  provenance?: Provenance | null;
}

// ---------------------------------------------------------------------------
// alerts read (docs/12 §2.6).
// ---------------------------------------------------------------------------
export interface Alert {
  id: string;
  region_id: string;
  indicator_id: string | null;
  severity: AlertSeverity;
  title: string;
  message: string | null;
  triggered_value: number | null;
  threshold: number | null;
  triggered_at: string;
  acknowledged: boolean;
}

// ---------------------------------------------------------------------------
// Edge Function payloads (docs/12 §3).
// ---------------------------------------------------------------------------
export interface Period {
  start: string;
  end: string;
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
  components: RiskComponents;
}

export interface ConfidenceRequest {
  metric_kind?: MetricKind;
  metric_id?: string;
  region_id?: string;
  indicator?: string;
  date?: string;
}

export interface ConfidenceData {
  metric_kind: MetricKind;
  metric_id: string;
  score: number;
  level: ConfidenceLevel;
  factors: Partial<Record<ConfidenceFactorKey, ConfidenceFactor>>;
}

// ---------------------------------------------------------------------------
// Minimal GeoJSON (only what the map layer needs — Polygon / MultiPolygon).
// ---------------------------------------------------------------------------
export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}
export interface GeoJsonMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}
export type GeoJsonGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

// ---------------------------------------------------------------------------
// The Validation Envelope (docs/09 §1 — the five fields). A view-model
// assembled from a metric's provenance + confidence, shown on EVERY metric.
// ---------------------------------------------------------------------------
export interface ValidationEnvelopeData {
  metricCode: string;
  value: number | string | null;
  unit?: string;
  /** Source — dataset(s)/model that produced the value. */
  source: string;
  /** Date — valid time of the underlying observation. */
  date: string | null;
  /** Methodology — how it was computed. */
  methodology: string;
  /** Confidence — level + optional 0..1 score. */
  confidenceLevel: ConfidenceLevel | null;
  confidenceScore: number | null;
  /** Explanation — plain-language justification. */
  explanation: string;
  /** Whether this metric is illustrative synthetic demo data (not real EO). */
  isDemo: boolean;
  provenanceId?: string;
  attribution?: string | null;
  factors?: Partial<Record<ConfidenceFactorKey, ConfidenceFactor>>;
}
