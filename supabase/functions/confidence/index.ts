// =============================================================================
// confidence — compute/return the Validation-Envelope confidence for a metric
// POST /functions/v1/confidence   (docs/12-api-specification.md §3.6)
//
// Auth: analyst | admin (results readable by all via embed). Rate limit: 60/min.
//
// Computes the six-factor weighted GEOMETRIC mean (docs/09):
//   freshness 0.20, source_quality 0.20, spatial_coverage 0.20,
//   temporal_completeness 0.15, model_validation 0.15, convergence 0.10
// dropping non-applicable factors and renormalizing (docs/09 §4.2).
//
// Request forms accepted:
//   A. metric-reference (docs/12 §3.6):  { metric_kind, metric_id }
//   B. descriptor (build brief):         { region_id, indicator, date }
// Form B resolves the indicator_value row first (region+indicator+nearest date),
// then proceeds as Form A with metric_kind='indicator_value'.
//
// HONEST-DATA RULE: 404 if the referenced metric does not exist; 422 if NO
// factor input can be derived (confidence reported as unavailable, never
// fabricated — docs/09 §8a; docs/12 §3.6).
//
// FACTOR-INPUT ASSUMPTIONS (documented; sourced from stored metadata):
//   - freshness:            age = (now - obs_date) vs dataset.freshness_threshold_days
//                           (T_expected). If no dataset cadence -> per-category default.
//   - source_quality:       optical (category vegetation/water from S2) ->
//                           1 - provenance.parameters.cloud_fraction when present;
//                           else dataset.source_quality prior.
//   - spatial_coverage:     provenance.parameters.valid_pixel_fraction (or
//                           spatial_coverage), else observations.valid_pixel_fraction
//                           averaged over the period; domain coverage for non-pixel.
//   - temporal_completeness:provenance.parameters.{n_observations,n_expected}, else
//                           observation count over the period vs expected (skipped if
//                           unknown).
//   - model_validation:     only for model-derived metrics (provenance.model_run_id);
//                           model_runs.validation_score mapped via clip((m-floor)/(1-floor)).
//   - convergence:          provenance.parameters.convergence when the pipeline
//                           recorded cross-proxy agreement; else dropped.
// Applicability per indicator group follows docs/09 §5 / §8b.
// =============================================================================

import { handlePreflight } from "_shared/cors.ts";
import { serviceClient } from "_shared/supabase.ts";
import {
  fail,
  guard,
  newRequestId,
  ok,
  parseJson,
} from "_shared/http.ts";
import {
  buildConfidence,
  type FactorInputs,
  freshnessFromDate,
  modelValidation,
  sourceQualityOptical,
  sourceQualityPrior,
  spatialCoverageFraction,
  temporalCompleteness,
} from "_shared/confidence.ts";
import type {
  ConfidenceFactorKey,
  ConfidenceRequest,
  MetricKind,
  Provenance,
} from "_shared/types.ts";

const ENDPOINT = "confidence";
const ALLOWED = ["analyst", "admin"] as const;

// Per-category default expected cadence (days) when dataset cadence is unknown
// (docs/09 §5: S2 ~5d, SPI/precip ~30d, GRACE ~monthly).
const CATEGORY_T_EXPECTED: Record<string, number> = {
  vegetation: 5,
  water: 5,
  climate: 30,
  agriculture: 90,
  risk: 30,
};
const DEFAULT_T_EXPECTED = 30;

// Indicator groups that are model-derived (model_validation applies) — docs/09 §5.
const MODEL_DERIVED_INDICATORS = new Set<string>([
  "crop_class",
  "cropland_area_ha",
  "irrigated_area_ha",
  "agri_expansion_pct",
  "recharge_proxy_mm",
  "abstraction_estimate_mcm",
  "water_balance_mcm",
]);

// Indicator groups where convergence applies (>=2 independent proxies) — docs/09 §5.
const CONVERGENCE_INDICATORS = new Set<string>([
  "ndvi", "evi", "savi", "ndvi_anomaly", "ndwi", "mndwi",
  "surface_water_extent_km2",
  "precip_mm", "precip_anomaly_pct", "spi_1", "spi_3", "spi_6", "spi_12",
  "cropland_area_ha", "irrigated_area_ha", "crop_class", "agri_expansion_pct",
  "recharge_proxy_mm", "abstraction_estimate_mcm", "water_balance_mcm",
]);

// Optical indicators whose source_quality is cloud-driven — docs/09 §5.
const OPTICAL_INDICATORS = new Set<string>([
  "ndvi", "evi", "savi", "ndvi_anomaly", "ndwi", "mndwi", "surface_water_extent_km2",
]);

function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const requestId = newRequestId();

  if (req.method !== "POST") {
    return fail(req, "VALIDATION_ERROR", "Method not allowed; use POST.", undefined, requestId);
  }

  const g = await guard(req, {
    allowed: [...ALLOWED],
    endpoint: ENDPOINT,
    limit: 60,
    windowSeconds: 60,
    requestId,
  });
  if ("response" in g) return g.response;
  const { auth } = g;

  let body: ConfidenceRequest;
  try {
    body = await parseJson<ConfidenceRequest>(req);
  } catch (e) {
    return fail(req, "VALIDATION_ERROR", (e as Error).message, undefined, requestId);
  }

  const svc = serviceClient();

  // --- Resolve the target metric (Form A or Form B) ----------------------
  let metricKind: MetricKind;
  let metricId: string;
  // For indicator_value metrics we collect these for factor scoring:
  let indicatorCode: string | undefined;
  let indicatorCategory: string | null = null;
  let obsDate: string | undefined;
  let provenanceId: string | undefined;
  let regionId: string | undefined;

  if (body.metric_kind && body.metric_id) {
    // Form A: metric reference.
    metricKind = body.metric_kind;
    metricId = body.metric_id;
  } else if (body.region_id && body.indicator) {
    // Form B: descriptor -> resolve indicator_value row.
    metricKind = "indicator_value";
    const { data: ind, error: indErr } = await svc
      .from("indicators")
      .select("id, code, category")
      .eq("code", body.indicator)
      .maybeSingle();
    if (indErr) {
      return fail(req, "INTERNAL", `Indicator lookup failed: ${indErr.message}`, undefined, requestId);
    }
    if (!ind) {
      return fail(req, "NOT_FOUND", "Unknown indicator code.", { indicator: body.indicator }, requestId);
    }
    let q = svc
      .from("indicator_values")
      .select("id, indicator_id, obs_date, provenance_id, region_id")
      .eq("region_id", body.region_id)
      .eq("indicator_id", ind.id as string);
    if (isIsoDate(body.date)) {
      q = q.lte("obs_date", body.date);
    }
    const { data: ivRow, error: ivErr } = await q
      .order("obs_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ivErr) {
      return fail(req, "INTERNAL", `indicator_values lookup failed: ${ivErr.message}`, undefined, requestId);
    }
    if (!ivRow) {
      return fail(
        req,
        "UNPROCESSABLE",
        "No stored indicator value for this region/indicator/date — confidence cannot be computed.",
        { region_id: body.region_id, indicator: body.indicator, date: body.date ?? null },
        requestId,
      );
    }
    metricId = ivRow.id as string;
    indicatorCode = ind.code as string;
    indicatorCategory = (ind.category as string | null) ?? null;
    obsDate = ivRow.obs_date as string;
    provenanceId = ivRow.provenance_id as string;
    regionId = ivRow.region_id as string;
  } else {
    return fail(
      req,
      "VALIDATION_ERROR",
      "Provide either {metric_kind, metric_id} or {region_id, indicator[, date]}.",
      undefined,
      requestId,
    );
  }

  // --- Load the metric row (Form A path or to fill gaps) -----------------
  if (metricKind === "indicator_value" && (!indicatorCode || !provenanceId)) {
    const { data: iv, error } = await svc
      .from("indicator_values")
      .select("id, indicator_id, obs_date, provenance_id, region_id")
      .eq("id", metricId)
      .maybeSingle();
    if (error) {
      return fail(req, "INTERNAL", `indicator_values read failed: ${error.message}`, undefined, requestId);
    }
    if (!iv) {
      return fail(req, "NOT_FOUND", "indicator_value not found.", { metric_id: metricId }, requestId);
    }
    obsDate = iv.obs_date as string;
    provenanceId = iv.provenance_id as string;
    regionId = iv.region_id as string;
    const { data: ind } = await svc
      .from("indicators")
      .select("code, category")
      .eq("id", iv.indicator_id as string)
      .maybeSingle();
    indicatorCode = (ind?.code as string | undefined);
    indicatorCategory = (ind?.category as string | null) ?? null;
  } else if (metricKind !== "indicator_value") {
    // Other metric kinds: confirm existence + grab provenance + period.
    const table = metricKind === "risk_score"
      ? "risk_scores"
      : metricKind === "prediction"
      ? "predictions"
      : "scenario_results";
    const dateCol = metricKind === "risk_score" || metricKind === "scenario_result"
      ? "provenance_id"
      : "provenance_id";
    const { data: row, error } = await svc
      .from(table)
      .select(`id, provenance_id`)
      .eq("id", metricId)
      .maybeSingle();
    if (error) {
      return fail(req, "INTERNAL", `${table} read failed: ${error.message}`, undefined, requestId);
    }
    if (!row) {
      return fail(req, "NOT_FOUND", `${metricKind} not found.`, { metric_id: metricId }, requestId);
    }
    provenanceId = row.provenance_id as string;
    void dateCol;
  }

  // --- Load provenance (for parameters, dataset, model_run, period) ------
  let provenance: Provenance | null = null;
  let datasetSourceQuality: number | undefined;
  let datasetFreshnessDays: number | undefined;
  let datasetAttribution: string | null = null;
  let modelValidationScore: number | undefined;
  let provParams: Record<string, unknown> = {};
  let provPeriodStart: string | null = null;
  let provPeriodEnd: string | null = null;

  if (provenanceId) {
    const { data: p, error: pErr } = await svc
      .from("provenance")
      .select("id, source, dataset_id, ee_asset_id, period_start, period_end, processing_method, processing_version, parameters, model_run_id")
      .eq("id", provenanceId)
      .maybeSingle();
    if (pErr) {
      return fail(req, "INTERNAL", `provenance read failed: ${pErr.message}`, undefined, requestId);
    }
    if (p) {
      provParams = (p.parameters as Record<string, unknown>) ?? {};
      provPeriodStart = p.period_start as string | null;
      provPeriodEnd = p.period_end as string | null;
      if (p.dataset_id) {
        const { data: ds } = await svc
          .from("datasets")
          .select("source_quality, freshness_threshold_days, attribution")
          .eq("id", p.dataset_id as string)
          .maybeSingle();
        if (ds) {
          datasetSourceQuality = ds.source_quality === null ? undefined : Number(ds.source_quality);
          datasetFreshnessDays = ds.freshness_threshold_days === null
            ? undefined
            : Number(ds.freshness_threshold_days);
          datasetAttribution = (ds.attribution as string | null) ?? null;
        }
      }
      if (p.model_run_id) {
        const { data: mr } = await svc
          .from("model_runs")
          .select("validation_score")
          .eq("id", p.model_run_id as string)
          .maybeSingle();
        if (mr && mr.validation_score !== null) {
          modelValidationScore = Number(mr.validation_score);
        }
      }
      provenance = {
        id: p.id as string,
        source: p.source as string,
        dataset_id: p.dataset_id as string | null,
        ee_asset_id: p.ee_asset_id as string | null,
        period_start: provPeriodStart,
        period_end: provPeriodEnd,
        processing_method: p.processing_method as string,
        processing_version: p.processing_version as string,
        parameters: provParams,
        model_run_id: p.model_run_id as string | null,
        attribution: datasetAttribution,
      };
    }
  }

  // --- Derive the factor inputs from stored metadata ---------------------
  const factors: FactorInputs = {};
  const isModelDerived = (indicatorCode ? MODEL_DERIVED_INDICATORS.has(indicatorCode) : false) ||
    metricKind === "risk_score" || metricKind === "prediction" ||
    (provenance?.model_run_id != null);
  const wantsConvergence = indicatorCode ? CONVERGENCE_INDICATORS.has(indicatorCode) : true;
  const isOptical = indicatorCode ? OPTICAL_INDICATORS.has(indicatorCode) : false;

  // freshness (all metrics) — needs an observation date.
  const freshDate = obsDate ?? provPeriodEnd ?? undefined;
  if (freshDate) {
    const tExpected = datasetFreshnessDays ??
      CATEGORY_T_EXPECTED[indicatorCategory ?? ""] ?? DEFAULT_T_EXPECTED;
    factors.freshness = freshnessFromDate(freshDate, tExpected);
  }

  // source_quality (all metrics).
  const cloudFraction = num(provParams["cloud_fraction"]) ??
    num((provParams["source_quality_inputs"] as Record<string, unknown> | undefined)?.["cloud_fraction"]);
  if (isOptical && cloudFraction !== undefined) {
    const sensorReliability = datasetSourceQuality ?? 1.0;
    factors.source_quality = sourceQualityOptical(cloudFraction, sensorReliability);
  } else if (datasetSourceQuality !== undefined) {
    factors.source_quality = sourceQualityPrior(datasetSourceQuality);
  } else {
    const explicit = num(provParams["source_quality"]);
    if (explicit !== undefined) factors.source_quality = sourceQualityPrior(explicit);
  }

  // spatial_coverage (spatial metrics).
  let coverage = num(provParams["valid_pixel_fraction"]) ?? num(provParams["spatial_coverage"]);
  if (coverage === undefined && regionId && (provPeriodStart || provPeriodEnd)) {
    // Fall back to averaging observations.valid_pixel_fraction over the period.
    let oq = svc
      .from("observations")
      .select("valid_pixel_fraction")
      .eq("region_id", regionId)
      .not("valid_pixel_fraction", "is", null);
    if (provPeriodStart) oq = oq.gte("obs_time", `${provPeriodStart}T00:00:00Z`);
    if (provPeriodEnd) oq = oq.lte("obs_time", `${provPeriodEnd}T23:59:59Z`);
    const { data: obs } = await oq.limit(500);
    if (obs && obs.length > 0) {
      const vals = obs
        .map((o) => (o.valid_pixel_fraction === null ? null : Number(o.valid_pixel_fraction)))
        .filter((x): x is number => x !== null);
      if (vals.length > 0) coverage = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }
  if (coverage !== undefined) factors.spatial_coverage = spatialCoverageFraction(coverage);

  // temporal_completeness (time-series / aggregated metrics).
  const nObs = num(provParams["n_observations"]);
  const nExp = num(provParams["n_expected"]);
  if (nObs !== undefined && nExp !== undefined) {
    factors.temporal_completeness = temporalCompleteness(nObs, nExp);
  } else {
    const tc = num(provParams["temporal_completeness"]);
    if (tc !== undefined) factors.temporal_completeness = tc;
  }

  // model_validation (model-derived only).
  if (isModelDerived) {
    if (modelValidationScore !== undefined) {
      factors.model_validation = modelValidation(modelValidationScore, 0.5);
    } else {
      const mv = num(provParams["model_validation"]);
      if (mv !== undefined) factors.model_validation = mv;
    }
  }

  // convergence (>=2 independent proxies).
  if (wantsConvergence) {
    const conv = num(provParams["convergence"]);
    if (conv !== undefined) factors.convergence = conv;
    // else dropped (factor not applicable / not recorded).
  }

  // --- Aggregate (422 if nothing usable) ---------------------------------
  const confidence = buildConfidence(factors);
  if (!confidence) {
    // Persist nothing; surface "unavailable" honestly (docs/09 §8a).
    await audit(svc, auth.userId, "confidence_unavailable", metricId, {
      request_id: requestId,
      metric_kind: metricKind,
      reason: "no_applicable_factor_inputs",
    });
    return fail(
      req,
      "UNPROCESSABLE",
      "No factor inputs available; confidence is unavailable for this metric (not fabricated).",
      { metric_kind: metricKind, metric_id: metricId },
      requestId,
    );
  }

  // --- Persist confidence_scores (upsert) + audit ------------------------
  const { error: csErr } = await svc
    .from("confidence_scores")
    .upsert(
      {
        metric_kind: metricKind,
        metric_id: metricId,
        factors: confidence.factors,
        score: confidence.score,
        level: confidence.level,
      },
      { onConflict: "metric_kind,metric_id" },
    );
  if (csErr) {
    return fail(req, "INTERNAL", `confidence_scores upsert failed: ${csErr.message}`, undefined, requestId);
  }

  // Denormalize onto indicator_values.confidence for fast reads (docs/11 §6.6).
  if (metricKind === "indicator_value") {
    await svc.from("indicator_values").update({ confidence: confidence.score }).eq("id", metricId);
  } else if (metricKind === "risk_score") {
    await svc.from("risk_scores").update({ confidence: confidence.score }).eq("id", metricId);
  } else if (metricKind === "prediction") {
    await svc.from("predictions").update({ confidence: confidence.score }).eq("id", metricId);
  } else if (metricKind === "scenario_result") {
    await svc.from("scenario_results").update({ confidence: confidence.score }).eq("id", metricId);
  }

  await audit(svc, auth.userId, "confidence_compute", metricId, {
    request_id: requestId,
    metric_kind: metricKind,
    score: confidence.score,
    level: confidence.level,
    factors_used: Object.keys(confidence.factors),
  });

  // --- Response envelope (docs/12 §3.6 data shape) -----------------------
  return ok(
    req,
    {
      metric_kind: metricKind,
      metric_id: metricId,
      score: confidence.score,
      level: confidence.level,
      factors: confidence.factors,
    },
    {
      provenance: provenance ? [provenance] : undefined,
      confidence,
      meta: { request_id: requestId, cached: false },
    },
  );
});

async function audit(
  svc: ReturnType<typeof serviceClient>,
  actor: string,
  action: string,
  targetId: string | null,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    await svc.from("audit_log").insert({
      actor: `edge:confidence:${actor}`,
      action,
      target_kind: "confidence_score",
      target_id: targetId,
      detail,
    });
  } catch (_e) {
    // never break the response path
  }
}
