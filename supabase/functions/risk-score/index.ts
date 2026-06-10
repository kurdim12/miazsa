// =============================================================================
// risk-score — groundwater-stress index Edge Function
// POST /functions/v1/risk-score   (docs/12-api-specification.md §3.2)
//
// Auth: analyst | admin (viewer/judge read stored results via PostgREST §2.4).
// Rate limit: 30/min (docs/12 §1.8).
//
// Flow (docs/03 §5.4 reuse / docs/08):
//   1. Validate {region_id, period{start,end}, recompute?}.
//   2. Resolve region; 404 if absent.
//   3. (unless recompute) return the existing risk_scores row if present.
//   4. Read the stored indicator inputs (indicator_values) for region+period.
//   5. Compute the five normalized sub-indices (_shared/risk.ts).
//   6. Weighted sum -> gw_stress_index + class, with missing-data renorm.
//   7. Derive risk confidence = weighted geometric mean of the input metrics'
//      confidences using the (renormalized) sub-index weights (_shared/confidence.ts).
//   8. Upsert provenance (model_run_id of gw_stress_model), risk_scores
//      (+components jsonb), risk_factors, confidence_scores; write audit_log.
//   9. Return the standard envelope (docs/12 §3.2 data shape).
//
// HONEST-DATA RULE: if NO sub-index can be computed (no grounded inputs) -> 422
// UNPROCESSABLE. Missing individual components are dropped + renormalized, never
// fabricated (docs/08 §3.4, §8b).
// =============================================================================

import { handlePreflight } from "_shared/cors.ts";
import { serviceClient } from "_shared/supabase.ts";
import {
  fail,
  guard,
  newRequestId,
  ok,
  parseJson,
  PROCESSING_VERSION,
} from "_shared/http.ts";
import {
  aggregate,
  abstractionPressure,
  rechargeDeficit,
  regionalStorageGrace,
  RISK_KEYS,
  RISK_WEIGHTS,
  surfaceWaterDecline,
  vegWaterDivergence,
} from "_shared/risk.ts";
import { levelFromScore, weightedGeometricMean } from "_shared/confidence.ts";
import type {
  Period,
  Provenance,
  RegionRow,
  RiskComponentKey,
  RiskScoreRequest,
} from "_shared/types.ts";

const ENDPOINT = "risk-score";
const ALLOWED = ["analyst", "admin"] as const;

// Indicator codes feeding each sub-index (docs/08 §2 + §8a quick reference).
const ABSTRACTION_INDICATOR = "abstraction_estimate_mcm";
const RECHARGE_SPI_PRIMARY = "spi_6"; // §2.2 prefers SPI-6; fall back to spi_3 then spi_12.
const RECHARGE_SPI_FALLBACKS = ["spi_3", "spi_12"];
const NDVI_ANOMALY_INDICATOR = "ndvi_anomaly";
const DIVERGENCE_SPI_INDICATOR = "spi_3"; // §2.3 uses SPI-3.
const SURFACE_WATER_INDICATOR = "surface_water_extent_km2";
const GRACE_INDICATOR = "gws_anomaly_cm";

/**
 * Baseline reference parameters for the normalizations (docs/08 §2). These are
 * model hyperparameters; in production they live in models.hyperparams /
 * a config record (docs/08 §3.3). They are echoed into provenance.parameters
 * for reproducibility. Defaults below are conservative, transparent placeholders
 * (clearly recorded, not fabricated data) and CONFIGURABLE per region/scenario.
 */
const NORM_PARAMS = {
  abstraction: { q_low: 0, q_max: 50 }, // mcm safe-yield .. upper bound
  recharge: { z_ref: 0, z_floor: -2 }, // SPI 0 .. -2
  divergence: { div_min: 0, div_max: 4 }, // NDVI_anom_pos * (-SPI)_pos range
  surface_water: { e_ref: 12, e_min: 0 }, // km2 reference .. min extent
  grace: { z_ref: 0, z_floor: -2 },
};

interface IndicatorInput {
  code: string;
  value: number;
  confidence: number | null;
  obs_date: string;
  provenance_id: string;
}

// Validate ISO date (YYYY-MM-DD).
function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const requestId = newRequestId();

  if (req.method !== "POST") {
    return fail(req, "VALIDATION_ERROR", "Method not allowed; use POST.", undefined, requestId);
  }

  // --- Auth + role + rate limit ------------------------------------------
  const g = await guard(req, {
    allowed: [...ALLOWED],
    endpoint: ENDPOINT,
    limit: 30,
    windowSeconds: 60,
    requestId,
  });
  if ("response" in g) return g.response;
  const { auth } = g;

  // --- Parse + validate request ------------------------------------------
  let body: RiskScoreRequest;
  try {
    body = await parseJson<RiskScoreRequest>(req);
  } catch (e) {
    return fail(req, "VALIDATION_ERROR", (e as Error).message, undefined, requestId);
  }

  if (!body || typeof body.region_id !== "string" || body.region_id.length === 0) {
    return fail(req, "VALIDATION_ERROR", "`region_id` is required.", undefined, requestId);
  }
  const period = body.period as Period | undefined;
  if (!period || !isIsoDate(period.start) || !isIsoDate(period.end)) {
    return fail(
      req,
      "VALIDATION_ERROR",
      "`period.start` and `period.end` must be ISO dates (YYYY-MM-DD).",
      undefined,
      requestId,
    );
  }
  if (period.end < period.start) {
    return fail(
      req,
      "VALIDATION_ERROR",
      "`period.end` must be on or after `period.start`.",
      undefined,
      requestId,
    );
  }
  const recompute = body.recompute === true;

  const svc = serviceClient();

  // --- Resolve region (404 if absent) ------------------------------------
  const { data: region, error: regErr } = await svc
    .from("regions")
    .select("id, code, name_en, kind")
    .eq("id", body.region_id)
    .maybeSingle<RegionRow>();
  if (regErr) {
    return fail(req, "INTERNAL", `Region lookup failed: ${regErr.message}`, undefined, requestId);
  }
  if (!region) {
    return fail(req, "NOT_FOUND", "Region not found.", { region_id: body.region_id }, requestId);
  }

  // --- Idempotent read: return existing score unless recompute ------------
  if (!recompute) {
    const { data: existing, error: exErr } = await svc
      .from("risk_scores")
      .select("id, gw_stress_index, gw_stress_class, components, confidence, provenance_id")
      .eq("region_id", region.id)
      .eq("period_start", period.start)
      .eq("period_end", period.end)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (exErr) {
      return fail(req, "INTERNAL", `Existing-score lookup failed: ${exErr.message}`, undefined, requestId);
    }
    if (existing) {
      const prov = await loadProvenance(svc, existing.provenance_id as string);
      const conf = await loadRiskConfidence(svc, existing.id as string, existing.confidence as number | null);
      return ok(
        req,
        {
          region_id: region.id,
          period,
          gw_stress_index: Number(existing.gw_stress_index),
          gw_stress_class: existing.gw_stress_class,
          components: existing.components,
        },
        {
          provenance: prov ? [prov] : undefined,
          confidence: conf,
          meta: { request_id: requestId, cached: true },
        },
      );
    }
  }

  // --- Read stored indicator inputs for region+period --------------------
  // We take, per indicator code, the most recent value within the period.
  const neededCodes = [
    ABSTRACTION_INDICATOR,
    RECHARGE_SPI_PRIMARY,
    ...RECHARGE_SPI_FALLBACKS,
    NDVI_ANOMALY_INDICATOR,
    DIVERGENCE_SPI_INDICATOR,
    SURFACE_WATER_INDICATOR,
    GRACE_INDICATOR,
  ];
  const uniqueCodes = [...new Set(neededCodes)];

  const { data: indicatorRows, error: indErr } = await svc
    .from("indicators")
    .select("id, code")
    .in("code", uniqueCodes);
  if (indErr) {
    return fail(req, "INTERNAL", `Indicator catalog read failed: ${indErr.message}`, undefined, requestId);
  }
  const idToCode = new Map<string, string>();
  const codeToId = new Map<string, string>();
  for (const row of indicatorRows ?? []) {
    idToCode.set(row.id as string, row.code as string);
    codeToId.set(row.code as string, row.id as string);
  }

  const indicatorIds = [...idToCode.keys()];
  const inputsByCode = new Map<string, IndicatorInput>();

  if (indicatorIds.length > 0) {
    const { data: values, error: valErr } = await svc
      .from("indicator_values")
      .select("indicator_id, obs_date, value, confidence, provenance_id")
      .eq("region_id", region.id)
      .in("indicator_id", indicatorIds)
      .gte("obs_date", period.start)
      .lte("obs_date", period.end)
      .order("obs_date", { ascending: false });
    if (valErr) {
      return fail(req, "INTERNAL", `Indicator values read failed: ${valErr.message}`, undefined, requestId);
    }
    // First row per indicator_id is the most recent (DESC order).
    for (const v of values ?? []) {
      const code = idToCode.get(v.indicator_id as string);
      if (!code) continue;
      if (!inputsByCode.has(code)) {
        inputsByCode.set(code, {
          code,
          value: Number(v.value),
          confidence: v.confidence === null ? null : Number(v.confidence),
          obs_date: v.obs_date as string,
          provenance_id: v.provenance_id as string,
        });
      }
    }
  }

  const get = (code: string): IndicatorInput | null => inputsByCode.get(code) ?? null;

  // Recharge SPI with documented fallback (docs/08 §2.2).
  let rechargeSpi = get(RECHARGE_SPI_PRIMARY);
  const rechargeFallbacksUsed: string[] = [];
  if (!rechargeSpi) {
    for (const fb of RECHARGE_SPI_FALLBACKS) {
      const v = get(fb);
      if (v) {
        rechargeSpi = v;
        rechargeFallbacksUsed.push(fb);
        break;
      }
    }
  }

  const abstraction = get(ABSTRACTION_INDICATOR);
  const ndviAnom = get(NDVI_ANOMALY_INDICATOR);
  const divSpi = get(DIVERGENCE_SPI_INDICATOR);
  const surface = get(SURFACE_WATER_INDICATOR);
  const grace = get(GRACE_INDICATOR);

  // --- Compute the five sub-indices (null when inputs absent) -------------
  const subindices: Record<RiskComponentKey, number | null> = {
    abstraction_pressure: abstractionPressure(
      abstraction?.value ?? null,
      NORM_PARAMS.abstraction.q_low,
      NORM_PARAMS.abstraction.q_max,
    ),
    recharge_deficit: rechargeDeficit(
      rechargeSpi?.value ?? null,
      NORM_PARAMS.recharge.z_ref,
      NORM_PARAMS.recharge.z_floor,
    ),
    veg_water_divergence: vegWaterDivergence(
      ndviAnom?.value ?? null,
      divSpi?.value ?? null,
      NORM_PARAMS.divergence.div_min,
      NORM_PARAMS.divergence.div_max,
    ),
    surface_water_decline: surfaceWaterDecline(
      surface?.value ?? null,
      NORM_PARAMS.surface_water.e_ref,
      NORM_PARAMS.surface_water.e_min,
    ),
    regional_storage_grace: regionalStorageGrace(
      grace?.value ?? null,
      NORM_PARAMS.grace.z_ref,
      NORM_PARAMS.grace.z_floor,
    ),
  };

  // --- Aggregate (422 if every sub-index missing) ------------------------
  const agg = aggregate(subindices, RISK_WEIGHTS);
  if (!agg) {
    return fail(
      req,
      "UNPROCESSABLE",
      "Insufficient component data to compute a groundwater-stress index for this region/period.",
      {
        region_id: region.id,
        period,
        required_any_of: uniqueCodes,
        found: [...inputsByCode.keys()],
      },
      requestId,
    );
  }

  // --- Map each contributing sub-index to its input metric's confidence ---
  // (docs/08 §6: risk confidence = weighted geom mean of sub-index confidences,
  //  same weights, renormalized for dropped sub-indices.)
  const subindexConfidence: Record<RiskComponentKey, number | null> = {
    abstraction_pressure: abstraction?.confidence ?? null,
    recharge_deficit: rechargeSpi?.confidence ?? null,
    // divergence draws on two metrics; use the conservative (min) of the pair.
    veg_water_divergence: minConfidence(ndviAnom?.confidence, divSpi?.confidence),
    surface_water_decline: surface?.confidence ?? null,
    regional_storage_grace: grace?.confidence ?? null,
  };

  const confPairs = agg.contributing.map((k) => ({
    value: subindexConfidence[k],
    weight: RISK_WEIGHTS[k],
  }));
  const riskScore = weightedGeometricMean(confPairs);

  // Build a confidence object whose "factors" expose each sub-index's inherited
  // confidence + its active weight (transparent breakdown for the UI/judge).
  const riskConfidence = riskScore === null
    ? null
    : {
      score: Number(riskScore.toFixed(3)),
      level: levelFromScore(riskScore),
      factors: Object.fromEntries(
        agg.contributing
          .filter((k) => subindexConfidence[k] !== null)
          .map((k) => [
            k,
            {
              value: Number((subindexConfidence[k] as number).toFixed(4)),
              weight: agg.components[k].weight,
            },
          ]),
      ),
    };

  // --- Resolve gw_stress_model model_run_id for provenance linkage -------
  const modelRunId = await resolveGwStressModelRun(svc);

  // --- Persist: provenance -> risk_scores -> risk_factors -> confidence ---
  const provenanceParameters = {
    weights: RISK_WEIGHTS,
    normalization: NORM_PARAMS,
    contributing: agg.contributing,
    dropped: agg.dropped,
    recharge_spi_fallbacks_used: rechargeFallbacksUsed,
    near_threshold: agg.near_threshold,
    insufficient_corroboration: agg.insufficient_corroboration,
    input_sources: Object.fromEntries(
      [...inputsByCode.values()].map((i) => [i.code, i.provenance_id]),
    ),
  };

  const { data: provInsert, error: provErr } = await svc
    .from("provenance")
    .insert({
      source: "model:gw_stress_model",
      ee_asset_id: null,
      period_start: period.start,
      period_end: period.end,
      processing_method: "Weighted-sum groundwater stress index over 5 EO sub-indices (docs/08)",
      processing_version: PROCESSING_VERSION,
      parameters: provenanceParameters,
      model_run_id: modelRunId,
      computed_by: `edge:risk-score:${auth.userId}`,
    })
    .select("id, source, dataset_id, ee_asset_id, period_start, period_end, processing_method, processing_version, parameters, model_run_id")
    .single();
  if (provErr || !provInsert) {
    return fail(req, "INTERNAL", `Provenance insert failed: ${provErr?.message}`, undefined, requestId);
  }
  const provenanceId = provInsert.id as string;

  const components = agg.components;
  const confidenceForRow = riskConfidence?.score ?? null;

  const { data: rsInsert, error: rsErr } = await svc
    .from("risk_scores")
    .insert({
      region_id: region.id,
      period_start: period.start,
      period_end: period.end,
      gw_stress_index: agg.gw_stress_index,
      gw_stress_class: agg.gw_stress_class,
      components,
      confidence: confidenceForRow,
      provenance_id: provenanceId,
    })
    .select("id")
    .single();
  if (rsErr || !rsInsert) {
    return fail(req, "INTERNAL", `risk_scores insert failed: ${rsErr?.message}`, undefined, requestId);
  }
  const riskScoreId = rsInsert.id as string;

  // risk_factors: one row per contributing sub-index (docs/08 §8.2 / docs/11 §6.5).
  const factorRows = agg.contributing.map((k) => {
    const c = components[k];
    return {
      risk_score_id: riskScoreId,
      factor_key: k,
      factor_value: c.value, // normalized sub-index 0..100
      weight: c.weight,
      weighted_value: Number(((c.weight * c.value)).toFixed(4)),
      detail: {
        inherited_confidence: subindexConfidence[k],
        contribution: Number((c.weight * c.value).toFixed(2)),
      },
    };
  });
  if (factorRows.length > 0) {
    const { error: rfErr } = await svc.from("risk_factors").insert(factorRows);
    if (rfErr) {
      // Non-fatal for the response, but audited as a partial write.
      await audit(svc, auth.userId, "risk_score_factors_partial", riskScoreId, {
        request_id: requestId,
        error: rfErr.message,
      });
    }
  }

  // confidence_scores: upsert the risk metric's confidence (docs/11 §6.6).
  if (riskConfidence) {
    const { error: csErr } = await svc
      .from("confidence_scores")
      .upsert(
        {
          metric_kind: "risk_score",
          metric_id: riskScoreId,
          factors: riskConfidence.factors,
          score: riskConfidence.score,
          level: riskConfidence.level,
        },
        { onConflict: "metric_kind,metric_id" },
      );
    if (csErr) {
      await audit(svc, auth.userId, "risk_score_confidence_partial", riskScoreId, {
        request_id: requestId,
        error: csErr.message,
      });
    }
  }

  // audit_log on side effects (docs/12 §3, docs/17 §6.6).
  await audit(svc, auth.userId, "risk_score_compute", riskScoreId, {
    request_id: requestId,
    region_id: region.id,
    period,
    gw_stress_index: agg.gw_stress_index,
    gw_stress_class: agg.gw_stress_class,
    contributing: agg.contributing,
    dropped: agg.dropped,
    confidence: confidenceForRow,
  });

  // --- Response envelope (docs/12 §3.2 data shape) -----------------------
  const provenanceOut: Provenance = {
    id: provInsert.id as string,
    source: provInsert.source as string,
    dataset_id: provInsert.dataset_id as string | null,
    ee_asset_id: provInsert.ee_asset_id as string | null,
    period_start: provInsert.period_start as string | null,
    period_end: provInsert.period_end as string | null,
    processing_method: provInsert.processing_method as string,
    processing_version: provInsert.processing_version as string,
    parameters: provInsert.parameters as Record<string, unknown>,
    model_run_id: provInsert.model_run_id as string | null,
    attribution: "MIZAN groundwater-stress composite model (estimate from EO proxies)",
  };

  return ok(
    req,
    {
      region_id: region.id,
      period,
      gw_stress_index: agg.gw_stress_index,
      gw_stress_class: agg.gw_stress_class,
      components,
    },
    {
      provenance: [provenanceOut],
      confidence: riskConfidence ?? undefined,
      meta: {
        request_id: requestId,
        cached: false,
        note: agg.insufficient_corroboration
          ? "Only one sub-index available; result shown for transparency but not used to raise alerts (docs/08 §8b)."
          : undefined,
      },
    },
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minConfidence(a?: number | null, b?: number | null): number | null {
  const vals = [a, b].filter((x): x is number => typeof x === "number");
  if (vals.length === 0) return null;
  return Math.min(...vals);
}

async function resolveGwStressModelRun(
  svc: ReturnType<typeof serviceClient>,
): Promise<string | null> {
  // Find the gw_stress_model, then its most recent succeeded run (for model_run_id).
  const { data: model } = await svc
    .from("models")
    .select("id")
    .eq("key", "gw_stress_model")
    .maybeSingle();
  if (!model) return null;
  const { data: run } = await svc
    .from("model_runs")
    .select("id")
    .eq("model_id", model.id as string)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (run?.id as string | undefined) ?? null;
}

async function loadProvenance(
  svc: ReturnType<typeof serviceClient>,
  provenanceId: string,
): Promise<Provenance | null> {
  const { data: p } = await svc
    .from("provenance")
    .select("id, source, dataset_id, ee_asset_id, period_start, period_end, processing_method, processing_version, parameters, model_run_id")
    .eq("id", provenanceId)
    .maybeSingle();
  if (!p) return null;
  let attribution: string | null = "MIZAN groundwater-stress composite model";
  if (p.dataset_id) {
    const { data: ds } = await svc
      .from("datasets")
      .select("attribution")
      .eq("id", p.dataset_id as string)
      .maybeSingle();
    if (ds?.attribution) attribution = ds.attribution as string;
  }
  return {
    id: p.id as string,
    source: p.source as string,
    dataset_id: p.dataset_id as string | null,
    ee_asset_id: p.ee_asset_id as string | null,
    period_start: p.period_start as string | null,
    period_end: p.period_end as string | null,
    processing_method: p.processing_method as string,
    processing_version: p.processing_version as string,
    parameters: p.parameters as Record<string, unknown>,
    model_run_id: p.model_run_id as string | null,
    attribution,
  };
}

async function loadRiskConfidence(
  svc: ReturnType<typeof serviceClient>,
  riskScoreId: string,
  denormScore: number | null,
) {
  const { data: cs } = await svc
    .from("confidence_scores")
    .select("score, level, factors")
    .eq("metric_kind", "risk_score")
    .eq("metric_id", riskScoreId)
    .maybeSingle();
  if (cs) {
    return {
      score: Number(cs.score),
      level: cs.level,
      factors: cs.factors as Record<string, { value: number; weight: number }>,
    };
  }
  if (denormScore !== null) {
    return { score: denormScore, level: levelFromScore(denormScore), factors: {} };
  }
  return undefined;
}

async function audit(
  svc: ReturnType<typeof serviceClient>,
  actor: string,
  action: string,
  targetId: string | null,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    await svc.from("audit_log").insert({
      actor: `edge:risk-score:${actor}`,
      action,
      target_kind: "risk_score",
      target_id: targetId,
      detail,
    });
  } catch (_e) {
    // Audit must never break the response path; swallow.
  }
}
