// =============================================================================
// _shared/confidence.ts — Confidence factor scoring + weighted geometric mean
//
// Authoritative algorithm: docs/09-confidence-engine.md.
//   §2  six factors + weights
//   §3  factor scoring functions (freshness, source_quality, spatial_coverage,
//       temporal_completeness, model_validation, convergence)
//   §4  weighted GEOMETRIC mean over the *used* factors (renormalize weights),
//       level thresholds (High >=0.80 / Medium 0.50-0.79 / Low <0.50)
//
// Pure, unit-testable functions. No I/O. Reused by the confidence, risk-score,
// and ee-compute functions.
// =============================================================================

import type {
  ConfidenceFactor,
  ConfidenceFactorKey,
  ConfidenceLevel,
  ConfidenceObject,
} from "_shared/types.ts";

/** Canonical weights (docs/09 §2). Sum = 1.0 when all factors apply. */
export const DEFAULT_WEIGHTS: Record<ConfidenceFactorKey, number> = {
  freshness: 0.2,
  source_quality: 0.2,
  spatial_coverage: 0.2,
  temporal_completeness: 0.15,
  model_validation: 0.15,
  convergence: 0.1,
};

/** Small epsilon to avoid log(0) in the geometric mean (docs/09 §4.1). */
const EPS = 1e-6;

/** Clamp x into [0,1] (docs/09 §8a "Clamping"). */
export function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** Clamp x into [lo,hi]. */
export function clip(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

// ---------------------------------------------------------------------------
// §3.1 freshness — exponential decay past expected cadence.
//   ratio = age / T_expected ; freshness = exp(-max(0, ratio-1)/tau)
//   age <= T_expected -> 1 ; decays smoothly beyond.
// ---------------------------------------------------------------------------
export function freshness(ageDays: number, tExpectedDays: number, tau = 1.0): number {
  const ratio = ageDays / Math.max(tExpectedDays, 1e-9);
  return clamp01(Math.exp(-Math.max(0, ratio - 1) / tau));
}

/** Convenience: freshness from an observation date string vs. "now". */
export function freshnessFromDate(
  observedAt: string,
  tExpectedDays: number,
  now: Date = new Date(),
  tau = 1.0,
): number {
  const obs = new Date(observedAt + (observedAt.length === 10 ? "T00:00:00Z" : ""));
  const ageMs = now.getTime() - obs.getTime();
  const ageDays = Math.max(0, ageMs / 86_400_000);
  return freshness(ageDays, tExpectedDays, tau);
}

// ---------------------------------------------------------------------------
// §3.2 source_quality.
//   Optical: q = 1 - cloud_fraction (optionally floored by sensor reliability).
//   Products: a fixed per-product reliability prior (datasets.source_quality).
// We expose two helpers; callers pick the one matching the source.
// ---------------------------------------------------------------------------
export function sourceQualityOptical(cloudFraction: number, sensorReliability = 1.0): number {
  const fromCloud = 1 - clamp01(cloudFraction);
  return clamp01(Math.min(fromCloud, sensorReliability));
}

export function sourceQualityPrior(productReliability: number): number {
  return clamp01(productReliability);
}

// ---------------------------------------------------------------------------
// §3.3 spatial_coverage — valid-pixel fraction within AOI.
// ---------------------------------------------------------------------------
export function spatialCoverage(validPixels: number, totalPixels: number): number {
  if (totalPixels <= 0) return 0;
  return clamp01(validPixels / totalPixels);
}

export function spatialCoverageFraction(fraction: number): number {
  return clamp01(fraction);
}

// ---------------------------------------------------------------------------
// §3.4 temporal_completeness — observations present vs expected.
// ---------------------------------------------------------------------------
export function temporalCompleteness(nObservations: number, nExpected: number): number {
  if (nExpected <= 0) return 0;
  return clamp01(nObservations / nExpected);
}

// ---------------------------------------------------------------------------
// §3.5 model_validation — map a held-out cross-val metric to [0,1].
//   model_validation = clip((metric - floor)/(1 - floor), 0, 1)
// ---------------------------------------------------------------------------
export function modelValidation(metric: number, metricFloor = 0.5): number {
  if (metricFloor >= 1) return 0;
  return clamp01((metric - metricFloor) / (1 - metricFloor));
}

// ---------------------------------------------------------------------------
// §3.6 convergence — agreement among >=2 independent indicators.
//   convergence = 1 - clip(std(z_i)/std_max, 0, 1)
//   <2 indicators -> null (factor not applicable).
// ---------------------------------------------------------------------------
export function convergence(zValues: number[], stdMax: number): number | null {
  if (!zValues || zValues.length < 2) return null;
  const mean = zValues.reduce((a, b) => a + b, 0) / zValues.length;
  const variance = zValues.reduce((a, b) => a + (b - mean) ** 2, 0) / zValues.length;
  const std = Math.sqrt(variance);
  if (stdMax <= 0) return 1;
  return clamp01(1 - Math.min(std / stdMax, 1));
}

// ---------------------------------------------------------------------------
// §4.3 level thresholds.
// ---------------------------------------------------------------------------
export function levelFromScore(score: number): ConfidenceLevel {
  if (score >= 0.8) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}

/** A factor input: a value in [0,1] or null (not applicable -> dropped). */
export type FactorInputs = Partial<Record<ConfidenceFactorKey, number | null>>;

/**
 * §4.1 weighted geometric mean over the USED factors (value !== null), with
 * weights renormalized to sum to 1 across the used set.
 *
 * Returns null when no factor is usable (docs/09 §8a "All required factors
 * missing" — null, never a fabricated default).
 */
export function geometricMean(
  factors: FactorInputs,
  weights: Record<ConfidenceFactorKey, number> = DEFAULT_WEIGHTS,
): number | null {
  const used: Array<[ConfidenceFactorKey, number, number]> = [];
  for (const key of Object.keys(weights) as ConfidenceFactorKey[]) {
    const v = factors[key];
    if (v === null || v === undefined) continue;
    used.push([key, clamp01(v), weights[key]]);
  }
  if (used.length === 0) return null;
  const wsum = used.reduce((acc, [, , w]) => acc + w, 0);
  if (wsum <= 0) return null;
  let logc = 0;
  for (const [, v, w] of used) {
    logc += (w / wsum) * Math.log(Math.max(v, EPS));
  }
  return clamp01(Math.exp(logc));
}

/**
 * Build the full ConfidenceObject (score + level + per-factor {value, weight})
 * from factor inputs. The weights stored are the RENORMALIZED weights over the
 * used factors, so the breakdown reproduces the score (docs/09 §4.2).
 *
 * Returns null if no factor is usable (caller decides how to surface "unavailable").
 */
export function buildConfidence(
  factors: FactorInputs,
  weights: Record<ConfidenceFactorKey, number> = DEFAULT_WEIGHTS,
): ConfidenceObject | null {
  const usedKeys: ConfidenceFactorKey[] = [];
  for (const key of Object.keys(weights) as ConfidenceFactorKey[]) {
    const v = factors[key];
    if (v === null || v === undefined) continue;
    usedKeys.push(key);
  }
  if (usedKeys.length === 0) return null;

  const wsum = usedKeys.reduce((acc, k) => acc + weights[k], 0);
  const score = geometricMean(factors, weights);
  if (score === null) return null;

  const out: Partial<Record<ConfidenceFactorKey, ConfidenceFactor>> = {};
  for (const key of usedKeys) {
    out[key] = {
      value: Number(clamp01(factors[key] as number).toFixed(4)),
      weight: Number((weights[key] / wsum).toFixed(4)),
    };
  }
  return {
    score: Number(score.toFixed(3)),
    level: levelFromScore(score),
    factors: out,
  };
}

/**
 * Per docs/08 §6 / docs/09 §8.3: the risk score's confidence is the weighted
 * geometric mean of the sub-index confidences using the (renormalized)
 * sub-index weights. This is a structurally identical geometric mean but over
 * an arbitrary keyed set (the five risk sub-indices), so we provide a generic
 * helper here too.
 */
export function weightedGeometricMean(
  pairs: Array<{ value: number | null; weight: number }>,
): number | null {
  const used = pairs.filter((p) => p.value !== null && p.value !== undefined) as Array<
    { value: number; weight: number }
  >;
  if (used.length === 0) return null;
  const wsum = used.reduce((acc, p) => acc + p.weight, 0);
  if (wsum <= 0) return null;
  let logc = 0;
  for (const p of used) {
    logc += (p.weight / wsum) * Math.log(Math.max(clamp01(p.value), EPS));
  }
  return clamp01(Math.exp(logc));
}
