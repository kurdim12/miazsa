// =============================================================================
// src/lib/format.ts — Formatting + small domain helpers.
//
// Confidence level thresholds: High >= 0.80, Medium 0.50-0.79, Low < 0.50
//   (docs/09 §4.3). Stress classes: Low 0-25 / Moderate 25-50 / High 50-75 /
//   Severe 75-100 (docs/08 §4).
// =============================================================================

import type {
  ConfidenceLevel,
  GwStressClass,
  Provenance,
  RiskComponentKey,
} from "@/lib/types";

/** The sentinel prefix that marks synthetic local seed data (per the contract). */
export const DEMO_SOURCE_PREFIX = "ILLUSTRATIVE DEMO";

/** Map a 0..1 confidence score to its level (docs/09 §4.3). */
export function levelFromScore(score: number | null | undefined): ConfidenceLevel | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  if (score >= 0.8) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}

/** Map a 0..100 index to its stress class (docs/08 §4). */
export function classFromIndex(index: number): GwStressClass {
  const x = Math.min(100, Math.max(0, index));
  if (x < 25) return "Low";
  if (x < 50) return "Moderate";
  if (x < 75) return "High";
  return "Severe";
}

/** A score near a 25-band boundary (±tol) is "near-threshold" (docs/08 §4, §8b). */
export function isNearThreshold(index: number, tol = 3): boolean {
  return [25, 50, 75].some((b) => Math.abs(index - b) <= tol);
}

/** Tailwind color tokens for each stress class (tailwind.config stress.*). */
export const STRESS_COLORS: Record<GwStressClass, string> = {
  Low: "#16A34A",
  Moderate: "#CA8A04",
  High: "#EA580C",
  Severe: "#DC2626",
};

/** Tailwind color tokens for each confidence level (tailwind.config confidence.*). */
export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  High: "#0D9488",
  Medium: "#D97706",
  Low: "#9CA3AF",
};

/** Canonical sub-index weights (docs/08 §3.1). */
export const RISK_WEIGHTS: Record<RiskComponentKey, number> = {
  abstraction_pressure: 0.3,
  recharge_deficit: 0.25,
  veg_water_divergence: 0.2,
  surface_water_decline: 0.15,
  regional_storage_grace: 0.1,
};

/** Sub-index display order (docs/08 §2). */
export const RISK_KEYS: RiskComponentKey[] = [
  "abstraction_pressure",
  "recharge_deficit",
  "veg_water_divergence",
  "surface_water_decline",
  "regional_storage_grace",
];

/** Human labels for the sub-indices (docs/08 §2 / §7). */
export const RISK_LABELS: Record<RiskComponentKey, string> = {
  abstraction_pressure: "Abstraction pressure",
  recharge_deficit: "Recharge deficit",
  veg_water_divergence: "Vegetation–water divergence",
  surface_water_decline: "Surface-water decline",
  regional_storage_grace: "Regional storage (GRACE)",
};

/**
 * Is this metric backed by synthetic demo data? True when the provenance source
 * starts with the ILLUSTRATIVE DEMO sentinel (the contract's demo-data rule).
 */
export function isDemoProvenance(prov: Provenance | null | undefined): boolean {
  if (!prov?.source) return false;
  return prov.source.trim().toUpperCase().startsWith(DEMO_SOURCE_PREFIX.toUpperCase());
}

// ---------------------------------------------------------------------------
// Number / date formatting.
// ---------------------------------------------------------------------------

/** Format a numeric value with a sensible precision; null -> em dash. */
export function formatValue(
  value: number | string | null | undefined,
  maxFractionDigits = 2,
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 1 : maxFractionDigits;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** Append a unit if present (handles unit-less "1" and "index_0_100"). */
export function formatWithUnit(
  value: number | string | null | undefined,
  unit?: string | null,
): string {
  const v = formatValue(value);
  if (v === "—") return v;
  if (!unit || unit === "1" || unit === "index_0_100") return v;
  return `${v} ${unit}`;
}

/** Format an ISO date (YYYY-MM-DD or full ISO) as a readable date; null -> em dash. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Format a 0..1 score as a 2-decimal string; null -> em dash. */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "—";
  return score.toFixed(2);
}

/** Title-case a snake_case key for display. */
export function humanizeKey(key: string): string {
  return key
    .split(/[_\s]+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
