// =============================================================================
// ee-compute — on-demand EO computation Edge Function
// POST /functions/v1/ee-compute   (docs/12-api-specification.md §3.1)
//
// Auth: analyst | admin. Rate limit: 10/min, 100/day (docs/12 §1.8).
//
// Flow (docs/03 §5.2):
//   1. Validate {region_id?|aoi(GeoJSON Polygon), indicators[], period, options}.
//   2. Resolve region_id, or upsert an ad-hoc AOI region (deterministic by AOI hash).
//   3. Compute an idempotency key from (aoi/region, indicators, period, version).
//      If a matching prior computation exists -> return it (cached, no re-run).
//   4. Call the EE Worker: POST $EE_WORKER_URL/compute with
//      Authorization: Bearer $EE_WORKER_AUTH_TOKEN.
//   5. Sync result -> persist provenance + indicator_values + confidence_scores;
//      return 200 envelope (docs/12 §3.1 data shape).
//      Long job -> return 202 + {job_id, status} + meta.poll.
//   6. Worker/GEE failure -> 502; timeout signal -> the worker should 202; we map
//      a fetch timeout to 504. audit_log on side effects.
//
// HONEST-DATA RULE: no imagery in period -> 422 (the worker signals empty
// results); we NEVER fabricate values. Every persisted value gets provenance +
// confidence.
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
  buildConfidence,
  type FactorInputs,
  freshnessFromDate,
  sourceQualityOptical,
  sourceQualityPrior,
  spatialCoverageFraction,
  temporalCompleteness,
} from "_shared/confidence.ts";
import type {
  EeComputeRequest,
  EeComputeResultItem,
  EeWorkerResponse,
  GeoJSONPolygon,
  Provenance,
} from "_shared/types.ts";

const ENDPOINT = "ee-compute";
const ALLOWED = ["analyst", "admin"] as const;

// AOI guardrail (docs/12 §1.7 example: max 5000 km2). Rough bbox-area check.
const MAX_AOI_KM2 = 5000;
// Worker call budget; beyond this we expect a 202 from the worker. A hard fetch
// timeout maps to 504 (docs/12 §1.7 — long jobs should 202 instead).
const WORKER_TIMEOUT_MS = Number(Deno.env.get("EE_WORKER_TIMEOUT_MS") ?? "55000");

const OPTICAL_INDICATORS = new Set<string>([
  "ndvi", "evi", "savi", "ndvi_anomaly", "ndwi", "mndwi", "surface_water_extent_km2",
]);
const CONVERGENCE_INDICATORS = new Set<string>([
  "ndvi", "evi", "savi", "ndvi_anomaly", "ndwi", "mndwi", "surface_water_extent_km2",
  "precip_mm", "precip_anomaly_pct", "spi_1", "spi_3", "spi_6", "spi_12",
]);

function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

/** Validate a GeoJSON Polygon (closed linear rings, lon/lat in range). */
function validatePolygon(aoi: unknown): { ok: true; poly: GeoJSONPolygon } | { ok: false; msg: string } {
  if (!aoi || typeof aoi !== "object") return { ok: false, msg: "aoi must be a GeoJSON Polygon." };
  const p = aoi as Record<string, unknown>;
  if (p.type !== "Polygon") return { ok: false, msg: "aoi.type must be 'Polygon'." };
  const coords = p.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) {
    return { ok: false, msg: "aoi.coordinates must be a non-empty ring array." };
  }
  for (const ring of coords as unknown[]) {
    if (!Array.isArray(ring) || ring.length < 4) {
      return { ok: false, msg: "Each ring needs >= 4 positions (closed)." };
    }
    for (const pt of ring as unknown[]) {
      if (!Array.isArray(pt) || pt.length < 2) return { ok: false, msg: "Each position needs [lon, lat]." };
      const [lon, lat] = pt as number[];
      if (typeof lon !== "number" || typeof lat !== "number") {
        return { ok: false, msg: "Coordinates must be numbers." };
      }
      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
        return { ok: false, msg: "Coordinates out of valid lon/lat range." };
      }
    }
    const first = (ring as number[][])[0];
    const last = (ring as number[][])[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return { ok: false, msg: "Polygon rings must be closed (first == last position)." };
    }
  }
  return { ok: true, poly: aoi as GeoJSONPolygon };
}

/** Rough geodesic area (km2) of a polygon's outer ring (shoelace on a sphere). */
function approxAreaKm2(poly: GeoJSONPolygon): number {
  const ring = poly.coordinates[0];
  if (!ring || ring.length < 4) return 0;
  const R = 6378.137; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    area += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((area * R * R) / 2);
}

/** Stable SHA-256 hex of a JSON-serializable value (idempotency + AOI id). */
async function sha256Hex(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
    limit: 10,
    windowSeconds: 60,
    requestId,
  });
  if ("response" in g) return g.response;
  const { auth } = g;

  // --- Parse + validate request ------------------------------------------
  let body: EeComputeRequest;
  try {
    body = await parseJson<EeComputeRequest>(req);
  } catch (e) {
    return fail(req, "VALIDATION_ERROR", (e as Error).message, undefined, requestId);
  }

  if (!body || !Array.isArray(body.indicators) || body.indicators.length === 0) {
    return fail(req, "VALIDATION_ERROR", "`indicators` must be a non-empty array.", undefined, requestId);
  }
  if (body.indicators.some((i) => typeof i !== "string" || i.length === 0)) {
    return fail(req, "VALIDATION_ERROR", "Each indicator must be a non-empty string code.", undefined, requestId);
  }
  if (!body.period || !isIsoDate(body.period.start) || !isIsoDate(body.period.end)) {
    return fail(req, "VALIDATION_ERROR", "`period.start`/`period.end` must be ISO dates.", undefined, requestId);
  }
  if (body.period.end < body.period.start) {
    return fail(req, "VALIDATION_ERROR", "`period.end` must be >= `period.start`.", undefined, requestId);
  }
  // No future end date (docs/17 §4.1 no-fabrication refinement).
  const todayIso = new Date().toISOString().slice(0, 10);
  if (body.period.end > todayIso) {
    return fail(req, "VALIDATION_ERROR", "`period.end` cannot be in the future.", { today: todayIso }, requestId);
  }
  if (!body.region_id && !body.aoi) {
    return fail(req, "VALIDATION_ERROR", "Provide `region_id` or `aoi` (GeoJSON Polygon).", undefined, requestId);
  }

  const svc = serviceClient();

  // --- Resolve region_id (existing region or ad-hoc AOI region) ----------
  let regionId: string;
  let aoiHash: string;

  if (body.region_id) {
    const { data: region, error } = await svc
      .from("regions")
      .select("id, geom")
      .eq("id", body.region_id)
      .maybeSingle();
    if (error) {
      return fail(req, "INTERNAL", `Region lookup failed: ${error.message}`, undefined, requestId);
    }
    if (!region) {
      return fail(req, "NOT_FOUND", "Region not found.", { region_id: body.region_id }, requestId);
    }
    regionId = region.id as string;
    aoiHash = `region:${regionId}`;
  } else {
    const v = validatePolygon(body.aoi);
    if (!v.ok) {
      return fail(req, "VALIDATION_ERROR", v.msg, undefined, requestId);
    }
    const areaKm2 = approxAreaKm2(v.poly);
    if (areaKm2 > MAX_AOI_KM2) {
      return fail(
        req,
        "VALIDATION_ERROR",
        `AOI exceeds maximum allowed area (${MAX_AOI_KM2} km2).`,
        { max_km2: MAX_AOI_KM2, got_km2: Math.round(areaKm2) },
        requestId,
      );
    }
    aoiHash = `aoi:${await sha256Hex(v.poly)}`;
    const code = `aoi_${aoiHash.slice(4, 20)}`;

    // Upsert an ad-hoc AOI region deterministically by code (docs/12 §3.1 side effects).
    const { data: existingRegion } = await svc
      .from("regions")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (existingRegion) {
      regionId = existingRegion.id as string;
    } else {
      // PostGIS: build MultiPolygon from the GeoJSON via RPC-free SQL is not
      // available through the JS client; we store geometry using ST_GeomFromGeoJSON
      // wrapped to MultiPolygon. supabase-js cannot call ST_* inline, so we rely on
      // a DB helper RPC `insert_aoi_region` when present, else store geom via the
      // GeoJSON-accepting insert (PostGIS casts GeoJSON text -> geometry).
      const multiGeoJson = {
        type: "MultiPolygon",
        coordinates: [v.poly.coordinates],
      };
      const insertRes = await svc
        .from("regions")
        .insert({
          code,
          name_en: `Ad-hoc AOI ${code}`,
          kind: "aoi",
          source: `user:${auth.userId}`,
          area_km2: Number(areaKm2.toFixed(2)),
          // PostGIS accepts a GeoJSON object cast to geometry on write via PostgREST.
          geom: multiGeoJson as unknown as string,
        })
        .select("id")
        .single();
      if (insertRes.error || !insertRes.data) {
        return fail(
          req,
          "INTERNAL",
          `Failed to persist ad-hoc AOI region: ${insertRes.error?.message}`,
          { hint: "Ensure regions.geom accepts GeoJSON (PostgREST geometry cast) or provide an insert_aoi_region RPC." },
          requestId,
        );
      }
      regionId = insertRes.data.id as string;
    }
  }

  // --- Idempotency: key over (aoi/region, indicators, period, version) ---
  const idemKey = await sha256Hex({
    aoiHash,
    indicators: [...body.indicators].sort(),
    period: body.period,
    processing_version: PROCESSING_VERSION,
    options: body.options ?? {},
  });

  // A prior provenance row carrying this idempotency key means we already computed
  // this exact request — return the stored values (cached) rather than re-running EE.
  {
    const { data: priorProv } = await svc
      .from("provenance")
      .select("id")
      .eq("source", "Earth Engine")
      .contains("parameters", { idempotency_key: idemKey })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorProv) {
      const cached = await loadCachedResults(svc, regionId, priorProv.id as string);
      if (cached.results.length > 0) {
        return ok(req, { region_id: regionId, results: cached.results }, {
          provenance: cached.provenance,
          meta: { request_id: requestId, cached: true },
        });
      }
    }
  }

  // --- Call the EE Worker -------------------------------------------------
  const workerUrl = Deno.env.get("EE_WORKER_URL");
  const workerToken = Deno.env.get("EE_WORKER_AUTH_TOKEN");
  if (!workerUrl || !workerToken) {
    return fail(req, "UNAVAILABLE", "EE Worker is not configured.", undefined, requestId);
  }

  let workerResp: EeWorkerResponse;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${workerUrl.replace(/\/$/, "")}/compute`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${workerToken}`,
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({
          region_id: regionId,
          aoi: body.aoi ?? null,
          indicators: body.indicators,
          period: body.period,
          options: body.options ?? {},
          processing_version: PROCESSING_VERSION,
          idempotency_key: idemKey,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 202) {
      // Long job accepted by the worker.
      const jobBody = (await res.json().catch(() => ({}))) as EeWorkerResponse;
      const jobId = jobBody.job_id ?? `job_${idemKey.slice(0, 20)}`;
      await audit(svc, auth.userId, "ee_compute_job_accepted", regionId, {
        request_id: requestId,
        job_id: jobId,
        indicators: body.indicators,
        period: body.period,
      });
      return ok(req, { job_id: jobId, status: "running" }, {
        status: 202,
        meta: {
          request_id: requestId,
          cached: false,
          poll: `/functions/v1/ee-compute?job_id=${jobId}`,
        },
      });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      await audit(svc, auth.userId, "ee_compute_upstream_error", regionId, {
        request_id: requestId,
        status: res.status,
        body: text.slice(0, 500),
      });
      return fail(
        req,
        "UPSTREAM_ERROR",
        "EE Worker / Google Earth Engine returned an error.",
        { upstream_status: res.status },
        requestId,
      );
    }

    workerResp = (await res.json()) as EeWorkerResponse;
  } catch (e) {
    const err = e as Error;
    if (err.name === "AbortError") {
      // Compute exceeded our sync budget; instruct caller to poll (docs/12 §1.7).
      return fail(
        req,
        "TIMEOUT",
        "EO computation exceeded the synchronous budget; retry — long jobs return 202 with a job id.",
        { timeout_ms: WORKER_TIMEOUT_MS },
        requestId,
      );
    }
    await audit(svc, auth.userId, "ee_compute_upstream_error", regionId, {
      request_id: requestId,
      error: err.message,
    });
    return fail(req, "UPSTREAM_ERROR", `EE Worker call failed: ${err.message}`, undefined, requestId);
  }

  // Worker may also signal async via JSON body.
  if (workerResp.status === "running" && workerResp.job_id) {
    await audit(svc, auth.userId, "ee_compute_job_accepted", regionId, {
      request_id: requestId,
      job_id: workerResp.job_id,
    });
    return ok(req, { job_id: workerResp.job_id, status: "running" }, {
      status: 202,
      meta: {
        request_id: requestId,
        cached: false,
        poll: `/functions/v1/ee-compute?job_id=${workerResp.job_id}`,
      },
    });
  }

  if (workerResp.status === "failed") {
    return fail(req, "UPSTREAM_ERROR", workerResp.error ?? "EE Worker reported failure.", undefined, requestId);
  }

  const results = workerResp.results ?? [];
  // HONEST-DATA: no grounded values for the period -> 422 (no fabrication).
  if (results.length === 0) {
    await audit(svc, auth.userId, "ee_compute_no_data", regionId, {
      request_id: requestId,
      indicators: body.indicators,
      period: body.period,
    });
    return fail(
      req,
      "UNPROCESSABLE",
      "No imagery / grounded values available for the requested indicators in this period.",
      { region_id: regionId, indicators: body.indicators, period: body.period },
      requestId,
    );
  }

  // --- Resolve indicator codes -> ids + dataset catalog ------------------
  const codes = [...new Set(results.map((r) => r.indicator))];
  const { data: indRows, error: indErr } = await svc
    .from("indicators")
    .select("id, code, category")
    .in("code", codes);
  if (indErr) {
    return fail(req, "INTERNAL", `Indicator catalog read failed: ${indErr.message}`, undefined, requestId);
  }
  const codeToIndicator = new Map<string, { id: string; category: string | null }>();
  for (const r of indRows ?? []) {
    codeToIndicator.set(r.code as string, { id: r.id as string, category: (r.category as string | null) ?? null });
  }
  const unknownCodes = codes.filter((c) => !codeToIndicator.has(c));
  if (unknownCodes.length > 0) {
    return fail(
      req,
      "VALIDATION_ERROR",
      "Unknown indicator code(s) returned by the worker.",
      { unknown: unknownCodes },
      requestId,
    );
  }

  // Dataset lookups (for source_quality prior, freshness cadence, attribution).
  const datasetKeys = [...new Set(results.map((r) => r.dataset_key).filter((k): k is string => !!k))];
  const datasetByKey = new Map<
    string,
    { id: string; source_quality: number | null; freshness_threshold_days: number | null; attribution: string }
  >();
  if (datasetKeys.length > 0) {
    const { data: dsRows } = await svc
      .from("datasets")
      .select("id, key, source_quality, freshness_threshold_days, attribution")
      .in("key", datasetKeys);
    for (const d of dsRows ?? []) {
      datasetByKey.set(d.key as string, {
        id: d.id as string,
        source_quality: d.source_quality === null ? null : Number(d.source_quality),
        freshness_threshold_days: d.freshness_threshold_days === null ? null : Number(d.freshness_threshold_days),
        attribution: d.attribution as string,
      });
    }
  }

  // --- Persist each result: provenance -> indicator_value -> confidence ---
  const out: EeComputeResultItem[] = [];
  const provenanceOut: Provenance[] = [];

  for (const r of results) {
    const indicator = codeToIndicator.get(r.indicator)!;
    const ds = r.dataset_key ? datasetByKey.get(r.dataset_key) : undefined;

    // provenance row (Earth Engine source; carries idempotency key in params).
    const params: Record<string, unknown> = {
      ...(r.parameters ?? {}),
      ...(body.options ?? {}),
      idempotency_key: idemKey,
    };
    if (r.valid_pixel_fraction !== undefined) params.valid_pixel_fraction = r.valid_pixel_fraction;
    if (r.cloud_fraction !== undefined) params.cloud_fraction = r.cloud_fraction;
    if (r.n_observations !== undefined) params.n_observations = r.n_observations;
    if (r.n_expected !== undefined) params.n_expected = r.n_expected;

    const { data: prov, error: provErr } = await svc
      .from("provenance")
      .insert({
        source: "Earth Engine",
        dataset_id: ds?.id ?? null,
        ee_asset_id: r.ee_asset_id ?? null,
        period_start: body.period.start,
        period_end: body.period.end,
        processing_method: r.processing_method ?? `EO pipeline for ${r.indicator}`,
        processing_version: PROCESSING_VERSION,
        parameters: params,
        model_run_id: null,
        computed_by: `edge:ee-compute:${auth.userId}`,
      })
      .select("id, source, dataset_id, ee_asset_id, period_start, period_end, processing_method, processing_version, parameters, model_run_id")
      .single();
    if (provErr || !prov) {
      return fail(req, "INTERNAL", `Provenance insert failed: ${provErr?.message}`, undefined, requestId);
    }
    const provId = prov.id as string;

    // indicator_value row (NOT NULL provenance — core invariant).
    const { data: iv, error: ivErr } = await svc
      .from("indicator_values")
      .upsert(
        {
          region_id: regionId,
          indicator_id: indicator.id,
          obs_date: r.obs_date,
          value: r.value,
          provenance_id: provId,
        },
        { onConflict: "region_id,indicator_id,obs_date,provenance_id" },
      )
      .select("id")
      .single();
    if (ivErr || !iv) {
      return fail(req, "INTERNAL", `indicator_values insert failed: ${ivErr?.message}`, undefined, requestId);
    }
    const ivId = iv.id as string;

    // Confidence factor inputs from what the worker measured (docs/09 §3).
    const factors: FactorInputs = {};
    const isOptical = OPTICAL_INDICATORS.has(r.indicator);
    const tExpected = ds?.freshness_threshold_days ?? (isOptical ? 5 : 30);
    factors.freshness = freshnessFromDate(r.obs_date, tExpected);
    if (isOptical && r.cloud_fraction !== undefined) {
      factors.source_quality = sourceQualityOptical(r.cloud_fraction, ds?.source_quality ?? 1.0);
    } else if (ds?.source_quality != null) {
      factors.source_quality = sourceQualityPrior(ds.source_quality);
    }
    const cov = num(r.valid_pixel_fraction);
    if (cov !== undefined) factors.spatial_coverage = spatialCoverageFraction(cov);
    if (r.n_observations !== undefined && r.n_expected !== undefined) {
      factors.temporal_completeness = temporalCompleteness(r.n_observations, r.n_expected);
    }
    // model_validation N/A for EO indices (deterministic). convergence only if the
    // worker recorded a cross-proxy agreement value.
    const conv = num((r.parameters ?? {})["convergence"]);
    if (conv !== undefined && CONVERGENCE_INDICATORS.has(r.indicator)) factors.convergence = conv;

    const confidence = buildConfidence(factors);
    if (confidence) {
      await svc.from("confidence_scores").upsert(
        {
          metric_kind: "indicator_value",
          metric_id: ivId,
          factors: confidence.factors,
          score: confidence.score,
          level: confidence.level,
        },
        { onConflict: "metric_kind,metric_id" },
      );
      await svc.from("indicator_values").update({ confidence: confidence.score }).eq("id", ivId);
    }

    out.push({
      indicator: r.indicator,
      obs_date: r.obs_date,
      value: r.value,
      provenance_id: provId,
      confidence: confidence
        ? { score: confidence.score, level: confidence.level }
        : { score: 0, level: "Low" },
    });
    provenanceOut.push({
      id: prov.id as string,
      source: prov.source as string,
      dataset_id: prov.dataset_id as string | null,
      ee_asset_id: prov.ee_asset_id as string | null,
      period_start: prov.period_start as string | null,
      period_end: prov.period_end as string | null,
      processing_method: prov.processing_method as string,
      processing_version: prov.processing_version as string,
      parameters: prov.parameters as Record<string, unknown>,
      model_run_id: prov.model_run_id as string | null,
      attribution: ds?.attribution ?? null,
    });
  }

  await audit(svc, auth.userId, "ee_compute", regionId, {
    request_id: requestId,
    indicators: body.indicators,
    period: body.period,
    count: out.length,
    idempotency_key: idemKey,
  });

  return ok(req, { region_id: regionId, results: out }, {
    provenance: provenanceOut,
    meta: { request_id: requestId, cached: false },
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadCachedResults(
  svc: ReturnType<typeof serviceClient>,
  regionId: string,
  provenanceId: string,
): Promise<{ results: EeComputeResultItem[]; provenance: Provenance[] }> {
  // All indicator_values written under provenance rows sharing this idempotency
  // key. For simplicity we load values tied to the matched provenance row and
  // any sibling provenance rows from the same compute (same idempotency_key).
  const { data: prov } = await svc
    .from("provenance")
    .select("parameters")
    .eq("id", provenanceId)
    .maybeSingle();
  const idemKey = (prov?.parameters as Record<string, unknown> | undefined)?.["idempotency_key"];
  if (!idemKey) return { results: [], provenance: [] };

  const { data: siblingProv } = await svc
    .from("provenance")
    .select("id, source, dataset_id, ee_asset_id, period_start, period_end, processing_method, processing_version, parameters, model_run_id")
    .contains("parameters", { idempotency_key: idemKey });
  const provIds = (siblingProv ?? []).map((p) => p.id as string);
  if (provIds.length === 0) return { results: [], provenance: [] };

  const { data: values } = await svc
    .from("indicator_values")
    .select("id, indicator_id, obs_date, value, confidence, provenance_id")
    .eq("region_id", regionId)
    .in("provenance_id", provIds)
    .order("obs_date", { ascending: false });

  const indIds = [...new Set((values ?? []).map((v) => v.indicator_id as string))];
  const codeById = new Map<string, string>();
  if (indIds.length > 0) {
    const { data: inds } = await svc.from("indicators").select("id, code").in("id", indIds);
    for (const i of inds ?? []) codeById.set(i.id as string, i.code as string);
  }

  // Attribution per dataset.
  const dsIds = [...new Set((siblingProv ?? []).map((p) => p.dataset_id).filter((x): x is string => !!x))];
  const attrById = new Map<string, string>();
  if (dsIds.length > 0) {
    const { data: ds } = await svc.from("datasets").select("id, attribution").in("id", dsIds);
    for (const d of ds ?? []) attrById.set(d.id as string, d.attribution as string);
  }

  const results: EeComputeResultItem[] = [];
  for (const v of values ?? []) {
    const score = v.confidence === null ? 0 : Number(v.confidence);
    results.push({
      indicator: codeById.get(v.indicator_id as string) ?? "unknown",
      obs_date: v.obs_date as string,
      value: Number(v.value),
      provenance_id: v.provenance_id as string,
      confidence: { score, level: score >= 0.8 ? "High" : score >= 0.5 ? "Medium" : "Low" },
    });
  }
  const provenance: Provenance[] = (siblingProv ?? []).map((p) => ({
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
    attribution: p.dataset_id ? attrById.get(p.dataset_id as string) ?? null : null,
  }));
  return { results, provenance };
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
      actor: `edge:ee-compute:${actor}`,
      action,
      target_kind: "region",
      target_id: targetId,
      detail,
    });
  } catch (_e) {
    // never break the response path
  }
}
