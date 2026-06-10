// =============================================================================
// _shared/risk.ts — Groundwater-stress sub-index normalization + aggregation
//
// Authoritative model: docs/08-risk-scoring.md.
//   §2  five sub-indices (each 0..100, higher = worse) + normalizations
//   §3  weighted sum (weights 0.30/0.25/0.20/0.15/0.10), §3.4 missing-data
//       renormalization, §4 classification (Low/Moderate/High/Severe)
//
// Pure, unit-testable functions. The Edge Function feeds these the stored
// indicator inputs and persists the result.
//
// IMPORTANT (honest-data rule, docs/12 §1.7): a sub-index whose inputs are
// absent is `null` and dropped from the weighted sum with renormalization — it
// is never imputed with a fabricated value.
// =============================================================================

import type { GwStressClass, RiskComponentKey } from "_shared/types.ts";
import { clip } from "_shared/confidence.ts";

/** Canonical sub-index weights (docs/08 §3.1). Sum = 1.0. */
export const RISK_WEIGHTS: Record<RiskComponentKey, number> = {
  abstraction_pressure: 0.3,
  recharge_deficit: 0.25,
  veg_water_divergence: 0.2,
  surface_water_decline: 0.15,
  regional_storage_grace: 0.1,
};

/** The five sub-index keys in canonical (display) order. */
export const RISK_KEYS: RiskComponentKey[] = [
  "abstraction_pressure",
  "recharge_deficit",
  "veg_water_divergence",
  "surface_water_decline",
  "regional_storage_grace",
];

// ---------------------------------------------------------------------------
// §4 classification thresholds. Equal 25-point bands.
//   Low 0-25 / Moderate 25-50 / High 50-75 / Severe 75-100.
// Boundary convention: lower-inclusive, upper-exclusive (except top band).
// ---------------------------------------------------------------------------
export function classify(index: number): GwStressClass {
  const x = clip(index, 0, 100);
  if (x < 25) return "Low";
  if (x < 50) return "Moderate";
  if (x < 75) return "High";
  return "Severe";
}

/** A scalar near a 25-band boundary (±tol) is "near-threshold" (docs/08 §4, §8b). */
export function isNearThreshold(index: number, tol = 3): boolean {
  for (const b of [25, 50, 75]) {
    if (Math.abs(index - b) <= tol) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// §2 sub-index normalizations. Each returns 0..100 (higher = worse) or null.
// All clip to [0,100] (docs/08 §8b "Saturation").
// ---------------------------------------------------------------------------

/**
 * §2.1 Abstraction pressure — baseline-referenced.
 *   sub = 100 * clip((abstraction - Q_low)/(Q_max - Q_low), 0, 1)
 */
export function abstractionPressure(
  abstractionMcm: number | null,
  qLow: number,
  qMax: number,
): number | null {
  if (abstractionMcm === null || abstractionMcm === undefined) return null;
  if (qMax <= qLow) return null;
  return 100 * clip((abstractionMcm - qLow) / (qMax - qLow), 0, 1);
}

/**
 * §2.2 Recharge deficit — baseline z-score (SPI is already standard-normal).
 *   sub = 100 * clip((z_ref - z)/(z_ref - z_floor), 0, 1)
 * with negative anomalies (drier) -> high score. Default z_ref=0, z_floor=-2
 * (i.e. SPI 0 -> 0 stress, SPI <= -2 -> full deficit).
 */
export function rechargeDeficit(
  z: number | null,
  zRef = 0,
  zFloor = -2,
): number | null {
  if (z === null || z === undefined) return null;
  if (zRef <= zFloor) return null;
  return 100 * clip((zRef - z) / (zRef - zFloor), 0, 1);
}

/**
 * §2.3 Vegetation-water divergence — min-max of a divergence statistic.
 *   div = NDVI_anomaly_pos * (-SPI)_pos   (green-up coincident with drought)
 * scaled 0..100 by min-max over the analysis range [divMin, divMax].
 */
export function vegWaterDivergence(
  ndviAnomaly: number | null,
  spi: number | null,
  divMin: number,
  divMax: number,
): number | null {
  if (
    ndviAnomaly === null || ndviAnomaly === undefined ||
    spi === null || spi === undefined
  ) {
    return null;
  }
  const ndviPos = Math.max(0, ndviAnomaly);
  const droughtPos = Math.max(0, -spi);
  const div = ndviPos * droughtPos;
  if (divMax <= divMin) return null;
  return 100 * clip((div - divMin) / (divMax - divMin), 0, 1);
}

/**
 * §2.4 Surface-water decline — baseline-referenced decline.
 *   sub = 100 * clip((E_ref - E_now)/(E_ref - E_min), 0, 1)
 */
export function surfaceWaterDecline(
  extentNowKm2: number | null,
  eRef: number,
  eMin: number,
): number | null {
  if (extentNowKm2 === null || extentNowKm2 === undefined) return null;
  if (eRef <= eMin) return null;
  return 100 * clip((eRef - extentNowKm2) / (eRef - eMin), 0, 1);
}

/**
 * §2.5 Regional storage (GRACE) — baseline z-score of the TWS anomaly trend.
 * More negative storage anomaly -> higher score. Default zRef=0, zFloor=-2.
 */
export function regionalStorageGrace(
  z: number | null,
  zRef = 0,
  zFloor = -2,
): number | null {
  if (z === null || z === undefined) return null;
  if (zRef <= zFloor) return null;
  return 100 * clip((zRef - z) / (zRef - zFloor), 0, 1);
}

// ---------------------------------------------------------------------------
// §3.1 / §3.4 aggregation with missing-data renormalization.
// ---------------------------------------------------------------------------
export interface SubIndexValue {
  /** Normalized sub-index 0..100, or null if its inputs were unavailable. */
  value: number | null;
}

export interface AggregationResult {
  gw_stress_index: number;
  gw_stress_class: GwStressClass;
  /** Active weights used (renormalized over available sub-indices). */
  components: Record<RiskComponentKey, { value: number; weight: number }>;
  /** Keys that contributed (non-null). */
  contributing: RiskComponentKey[];
  /** Keys dropped because their inputs were absent. */
  dropped: RiskComponentKey[];
  near_threshold: boolean;
  /** True when only one sub-index was available (docs/08 §8b: do not alert). */
  insufficient_corroboration: boolean;
}

/**
 * Weighted sum with §3.4 renormalization. `subindices` maps each key to its
 * value (or null). Drops nulls, renormalizes the remaining weights to sum to 1,
 * and computes the 0..100 index + class.
 *
 * Returns null when EVERY sub-index is missing (caller -> 422, no fabrication).
 */
export function aggregate(
  subindices: Record<RiskComponentKey, number | null>,
  weights: Record<RiskComponentKey, number> = RISK_WEIGHTS,
): AggregationResult | null {
  const contributing: RiskComponentKey[] = [];
  const dropped: RiskComponentKey[] = [];

  for (const k of RISK_KEYS) {
    const v = subindices[k];
    if (v === null || v === undefined || Number.isNaN(v)) dropped.push(k);
    else contributing.push(k);
  }
  if (contributing.length === 0) return null;

  const wsum = contributing.reduce((acc, k) => acc + weights[k], 0);
  if (wsum <= 0) return null;

  let index = 0;
  const components = {} as Record<RiskComponentKey, { value: number; weight: number }>;
  for (const k of contributing) {
    const wPrime = weights[k] / wsum;
    const v = clip(subindices[k] as number, 0, 100);
    index += wPrime * v;
    components[k] = {
      value: Number(v.toFixed(2)),
      weight: Number(wPrime.toFixed(4)),
    };
  }

  const rounded = Number(index.toFixed(2));
  return {
    gw_stress_index: rounded,
    gw_stress_class: classify(rounded),
    components,
    contributing,
    dropped,
    near_threshold: isNearThreshold(rounded),
    insufficient_corroboration: contributing.length < 2,
  };
}
