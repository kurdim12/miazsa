// =============================================================================
// src/lib/api.ts — Typed data access for the MIZAN web client.
//
// Reads: PostgREST over RLS-protected tables (docs/12 §2), embedding provenance
//   (+ its datasets attribution) so the Validation Envelope can be assembled.
//   `confidence_scores` is polymorphic (metric_kind, metric_id) and cannot be a
//   PostgREST FK embed — the denormalized `confidence` numeric carries the score,
//   and factor breakdowns are fetched on demand by metric_id.
// Writes/compute: Edge Functions returning the standard envelope (docs/12 §3).
//
// Honest-data rule (docs/12 §1.7): absence of data yields empty results / a
// thrown ApiError — NEVER a fabricated value.
// =============================================================================

import { supabase, functionsBaseUrl, isSupabaseConfigured } from "@/lib/supabase";
import type {
  Alert,
  ConfidenceData,
  ConfidenceObject,
  Envelope,
  Indicator,
  IndicatorValue,
  Period,
  Provenance,
  Region,
  RiskScore,
  RiskScoreData,
} from "@/lib/types";

/** A typed error mirroring the API error model (docs/12 §1.7). */
export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ApiError";
  }
}

function assertConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new ApiError(
      "UNAVAILABLE",
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env.",
    );
  }
}

/** Canonical region codes (docs/11 §10 seed). */
export const AZRAQ_CODE = "azraq_basin";
export const JORDAN_CODE = "jordan";

// PostgREST select fragments -------------------------------------------------

const PROVENANCE_EMBED =
  "provenance(id,source,ee_asset_id,period_start,period_end,processing_method," +
  "processing_version,parameters,model_run_id,datasets(name,attribution))";

const INDICATOR_EMBED = "indicators(id,code,name_en,name_ar,unit,category,value_min,value_max,description)";

// ---------------------------------------------------------------------------
// Embed normalization.
//
// supabase-js types embedded relations as arrays, but a to-one (foreign-key)
// embed returns a single object at runtime. These helpers coerce either shape to
// a single object and re-shape rows into our domain types, casting through
// `unknown` at the boundary (no `any`). They are runtime-safe whether PostgREST
// returns an object or a one-element array.
// ---------------------------------------------------------------------------

/** Coerce a to-one embed (object | array | null) to a single object or null. */
function toOne<T>(embed: unknown): T | null {
  if (embed == null) return null;
  if (Array.isArray(embed)) return (embed[0] as T | undefined) ?? null;
  return embed as T;
}

/** Normalize a raw indicator_values row (with embeds) into IndicatorValue. */
function normalizeIndicatorValue(raw: Record<string, unknown>): IndicatorValue {
  const r = raw as unknown as IndicatorValue & {
    provenance?: unknown;
    indicators?: unknown;
  };
  const prov = toOne<Provenance>(r.provenance);
  if (prov) prov.datasets = toOne<NonNullable<Provenance["datasets"]>>(prov.datasets ?? null);
  return {
    ...r,
    provenance: prov,
    indicators: toOne<Indicator>(r.indicators),
  };
}

/** Normalize a raw risk_scores row (with provenance embed) into RiskScore. */
function normalizeRiskScore(raw: Record<string, unknown>): RiskScore {
  const r = raw as unknown as RiskScore & { provenance?: unknown };
  const prov = toOne<Provenance>(r.provenance);
  if (prov) prov.datasets = toOne<NonNullable<Provenance["datasets"]>>(prov.datasets ?? null);
  return { ...r, provenance: prov };
}

// ---------------------------------------------------------------------------
// Regions (docs/12 §2.1).
// ---------------------------------------------------------------------------
export async function getRegions(): Promise<Region[]> {
  assertConfigured();
  const { data, error } = await supabase
    .from("regions")
    .select("id,code,name_en,name_ar,kind,area_km2")
    .order("kind", { ascending: true })
    .order("name_en", { ascending: true });
  if (error) throw new ApiError("INTERNAL", error.message);
  return (data ?? []) as Region[];
}

/** Fetch one region by code (e.g. 'azraq_basin'). */
export async function getRegionByCode(code: string): Promise<Region | null> {
  assertConfigured();
  const { data, error } = await supabase
    .from("regions")
    .select("id,code,name_en,name_ar,kind,area_km2")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new ApiError("INTERNAL", error.message);
  return (data as Region | null) ?? null;
}

export async function getAzraqRegion(): Promise<Region | null> {
  return getRegionByCode(AZRAQ_CODE);
}

/**
 * Fetch a region's geometry as GeoJSON (PostGIS ST_AsGeoJSON via an RPC is the
 * production path; for the slice we read the raw geom which PostgREST returns as
 * GeoJSON when the column is a PostGIS geometry through the geojson accessor).
 * Returns null when geometry can't be resolved — the map then fits to a
 * fallback bbox rather than fabricating a polygon.
 */
export async function getRegionGeometry(regionId: string): Promise<Region | null> {
  assertConfigured();
  const { data, error } = await supabase
    .from("regions")
    .select("id,code,name_en,name_ar,kind,area_km2,geom")
    .eq("id", regionId)
    .maybeSingle();
  if (error) {
    // geom may not be exposed as GeoJSON in all configs; treat as "no geometry".
    return null;
  }
  return (data as Region | null) ?? null;
}

// ---------------------------------------------------------------------------
// Indicator values with provenance + confidence embeds (docs/12 §2.3).
// ---------------------------------------------------------------------------

/**
 * Latest value per indicator for a region. PostgREST cannot do DISTINCT ON, so
 * we fetch recent rows ordered by date desc and reduce to the newest per
 * indicator client-side.
 */
export async function getIndicatorValues(regionId: string): Promise<IndicatorValue[]> {
  assertConfigured();
  const { data, error } = await supabase
    .from("indicator_values")
    .select(`id,region_id,indicator_id,obs_date,value,confidence,provenance_id,${INDICATOR_EMBED},${PROVENANCE_EMBED}`)
    .eq("region_id", regionId)
    .order("obs_date", { ascending: false })
    .limit(500);
  if (error) throw new ApiError("INTERNAL", error.message);

  const rows = ((data ?? []) as Record<string, unknown>[]).map(normalizeIndicatorValue);
  // Reduce to the latest row per indicator_id (rows are date-desc ordered).
  const latest = new Map<string, IndicatorValue>();
  for (const row of rows) {
    if (!latest.has(row.indicator_id)) latest.set(row.indicator_id, row);
  }
  return Array.from(latest.values());
}

/** Full time series for one indicator code in a region (ascending by date). */
export async function getIndicatorSeries(
  regionId: string,
  indicatorCode: string,
): Promise<IndicatorValue[]> {
  assertConfigured();
  const { data, error } = await supabase
    .from("indicator_values")
    .select(`id,region_id,indicator_id,obs_date,value,confidence,provenance_id,${INDICATOR_EMBED},${PROVENANCE_EMBED}`)
    .eq("region_id", regionId)
    .eq("indicators.code", indicatorCode)
    .order("obs_date", { ascending: true })
    .limit(1000);
  if (error) throw new ApiError("INTERNAL", error.message);
  // The embedded filter on indicators.code keeps only matching rows when the
  // join is present; guard against nulls just in case.
  return ((data ?? []) as Record<string, unknown>[])
    .map(normalizeIndicatorValue)
    .filter((r) => r.indicators?.code === indicatorCode);
}

// ---------------------------------------------------------------------------
// Risk scores with components + provenance embeds (docs/12 §2.4).
// ---------------------------------------------------------------------------
export async function getLatestRisk(regionId: string): Promise<RiskScore | null> {
  assertConfigured();
  const { data, error } = await supabase
    .from("risk_scores")
    .select(
      `id,region_id,period_start,period_end,gw_stress_index,gw_stress_class,components,confidence,provenance_id,${PROVENANCE_EMBED}`,
    )
    .eq("region_id", regionId)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new ApiError("INTERNAL", error.message);
  return data ? normalizeRiskScore(data as Record<string, unknown>) : null;
}

/** Full risk-score history for a region (ascending by period_end). */
export async function getRiskHistory(regionId: string): Promise<RiskScore[]> {
  assertConfigured();
  const { data, error } = await supabase
    .from("risk_scores")
    .select(
      `id,region_id,period_start,period_end,gw_stress_index,gw_stress_class,components,confidence,provenance_id,${PROVENANCE_EMBED}`,
    )
    .eq("region_id", regionId)
    .order("period_end", { ascending: true })
    .limit(500);
  if (error) throw new ApiError("INTERNAL", error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeRiskScore);
}

// ---------------------------------------------------------------------------
// Alerts (docs/12 §2.6).
// ---------------------------------------------------------------------------
export async function getAlerts(regionId?: string): Promise<Alert[]> {
  assertConfigured();
  let q = supabase
    .from("alerts")
    .select(
      "id,region_id,indicator_id,severity,title,message,triggered_value,threshold,triggered_at,acknowledged",
    )
    .order("triggered_at", { ascending: false })
    .limit(20);
  if (regionId) q = q.eq("region_id", regionId);
  const { data, error } = await q;
  if (error) throw new ApiError("INTERNAL", error.message);
  return (data ?? []) as Alert[];
}

// ---------------------------------------------------------------------------
// Confidence factor breakdown for a specific metric (polymorphic table).
// Used by the Validation Envelope when the caller wants the factor detail.
// ---------------------------------------------------------------------------
export async function getConfidenceScore(
  metricKind: ConfidenceData["metric_kind"],
  metricId: string,
): Promise<ConfidenceData | null> {
  assertConfigured();
  const { data, error } = await supabase
    .from("confidence_scores")
    .select("metric_kind,metric_id,score,level,factors")
    .eq("metric_kind", metricKind)
    .eq("metric_id", metricId)
    .maybeSingle();
  if (error) throw new ApiError("INTERNAL", error.message);
  return (data as ConfidenceData | null) ?? null;
}

// ---------------------------------------------------------------------------
// Edge Functions (docs/12 §3). Each returns the standard envelope (§1.6).
// We attach the caller's JWT (when signed in) so role-gated functions work; the
// anon key is always sent as `apikey`.
// ---------------------------------------------------------------------------

async function callEdge<TReq, TData>(
  fn: string,
  body: TReq,
  method: "POST" | "GET" = "POST",
): Promise<Envelope<TData>> {
  if (!functionsBaseUrl) {
    throw new ApiError("UNAVAILABLE", "Edge Functions base URL is not configured.");
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(`${functionsBaseUrl}/${fn}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${token ?? anon}`,
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const errBody = json as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      errBody?.error?.code ?? "INTERNAL",
      errBody?.error?.message ?? `Edge function ${fn} failed (HTTP ${res.status}).`,
    );
  }
  return json as Envelope<TData>;
}

/** POST /functions/v1/risk-score (docs/12 §3.2). Recompute the stress index. */
export async function callRiskScore(
  regionId: string,
  period: Period,
  recompute = true,
): Promise<Envelope<RiskScoreData>> {
  return callEdge<{ region_id: string; period: Period; recompute: boolean }, RiskScoreData>(
    "risk-score",
    { region_id: regionId, period, recompute },
  );
}

/** POST /functions/v1/confidence (docs/12 §3.6). Compute/return confidence. */
export async function callConfidence(
  metricKind: ConfidenceData["metric_kind"],
  metricId: string,
): Promise<Envelope<ConfidenceData>> {
  return callEdge<{ metric_kind: string; metric_id: string }, ConfidenceData>("confidence", {
    metric_kind: metricKind,
    metric_id: metricId,
  });
}

/**
 * Convenience: extract the aggregate ConfidenceObject from an envelope, falling
 * back to a {score, level} pair when only those are present.
 */
export function envelopeConfidence(env: Envelope<unknown>): ConfidenceObject | null {
  return env.confidence ?? null;
}
