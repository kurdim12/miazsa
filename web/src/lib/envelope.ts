// =============================================================================
// src/lib/envelope.ts — Assemble the Validation Envelope view-model.
//
// The Validation Envelope (docs/09 §1) has five fields — Source, Date,
// Methodology, Confidence, Explanation — and must appear on EVERY displayed
// metric. This module derives that view-model from a value's provenance +
// confidence so every UI surface builds it the same way.
// =============================================================================

import type {
  ConfidenceFactor,
  ConfidenceFactorKey,
  ConfidenceLevel,
  IndicatorValue,
  Provenance,
  RiskScore,
  ValidationEnvelopeData,
} from "@/lib/types";
import { humanizeKey, isDemoProvenance, levelFromScore } from "@/lib/format";

/** Resolve the Source string from a provenance record (+ dataset attribution). */
function sourceFrom(prov: Provenance | null | undefined): string {
  if (!prov) return "Unknown source";
  const dataset = prov.datasets?.name ?? undefined;
  const base = prov.source || "Earth Engine + MIZAN engine";
  if (dataset && !base.includes(dataset)) return `${base} · ${dataset}`;
  return base;
}

/** Resolve the valid Date (period_end preferred, else the metric's own date). */
function dateFrom(prov: Provenance | null | undefined, fallbackDate: string | null): string | null {
  return prov?.period_end ?? prov?.period_start ?? fallbackDate ?? null;
}

/** Methodology = processing_method (+ version) from provenance. */
function methodologyFrom(prov: Provenance | null | undefined): string {
  if (!prov?.processing_method) return "Methodology not recorded";
  return prov.processing_version
    ? `${prov.processing_method} (v${prov.processing_version})`
    : prov.processing_method;
}

/**
 * Deterministic template explanation (docs/09 §7): names the weakest factor(s)
 * when a factor breakdown is available; otherwise a generic, honest line.
 */
export function buildExplanation(
  level: ConfidenceLevel | null,
  score: number | null,
  factors: Partial<Record<ConfidenceFactorKey, ConfidenceFactor>> | undefined,
  isDemo: boolean,
): string {
  if (isDemo) {
    return "Illustrative demo value seeded locally — not derived from real Earth Observation data.";
  }
  if (level === null || score === null) {
    return "Confidence unavailable for this metric; treat as low until grounded inputs exist.";
  }
  const entries = factors
    ? (Object.entries(factors) as [ConfidenceFactorKey, ConfidenceFactor][])
        .filter(([, f]) => f && typeof f.value === "number")
        .sort((a, b) => a[1].value - b[1].value)
    : [];
  if (entries.length === 0) {
    return `Confidence ${level} (${score.toFixed(2)}). Derived from EO proxies; not a direct groundwater measurement.`;
  }
  const weakest = entries
    .slice(0, 2)
    .map(([k, f]) => `${humanizeKey(k)} (${f.value.toFixed(2)})`)
    .join(", ");
  return `Confidence ${level} (${score.toFixed(2)}). Main limiting factor(s): ${weakest}.`;
}

/** Build the envelope view-model for an indicator value. */
export function envelopeForIndicator(iv: IndicatorValue): ValidationEnvelopeData {
  const prov = iv.provenance ?? null;
  const isDemo = isDemoProvenance(prov);
  const level = levelFromScore(iv.confidence);
  const score = iv.confidence ?? null;
  return {
    metricCode: iv.indicators?.code ?? "indicator",
    value: iv.value,
    unit: iv.indicators?.unit ?? undefined,
    source: sourceFrom(prov),
    date: dateFrom(prov, iv.obs_date),
    methodology: methodologyFrom(prov),
    confidenceLevel: level,
    confidenceScore: score,
    explanation: buildExplanation(level, score, undefined, isDemo),
    isDemo,
    provenanceId: prov?.id,
    attribution: prov?.datasets?.attribution ?? prov?.attribution ?? null,
  };
}

/** Build the envelope view-model for a risk score. */
export function envelopeForRisk(rs: RiskScore): ValidationEnvelopeData {
  const prov = rs.provenance ?? null;
  const isDemo = isDemoProvenance(prov);
  const level = levelFromScore(rs.confidence);
  const score = rs.confidence ?? null;
  return {
    metricCode: "gw_stress_index",
    value: rs.gw_stress_index,
    unit: "index (0–100)",
    source: sourceFrom(prov) || "MIZAN risk engine + GEE sub-indices",
    date: dateFrom(prov, rs.period_end),
    methodology: methodologyFrom(prov) || "Weighted sub-index groundwater-stress score",
    confidenceLevel: level,
    confidenceScore: score,
    explanation: buildExplanation(level, score, undefined, isDemo),
    isDemo,
    provenanceId: prov?.id,
    attribution: prov?.datasets?.attribution ?? prov?.attribution ?? null,
  };
}

/**
 * Build an envelope view-model for an arbitrary sub-index / derived figure that
 * inherits a parent metric's provenance + confidence (docs/08 §6 — sub-indices
 * inherit the risk score's provenance).
 */
export function envelopeForDerived(
  metricCode: string,
  value: number | string | null,
  unit: string | undefined,
  parent: RiskScore,
): ValidationEnvelopeData {
  const base = envelopeForRisk(parent);
  return {
    ...base,
    metricCode,
    value,
    unit,
    explanation:
      base.explanation +
      " This sub-index inherits the groundwater-stress score's provenance and confidence.",
  };
}
