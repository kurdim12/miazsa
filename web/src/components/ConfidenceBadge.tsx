// =============================================================================
// components/ConfidenceBadge.tsx — Colored confidence pill (docs/13 §B.2).
//
// High -> teal, Medium -> amber, Low -> gray; a crimson "None" when no
// confidence data exists (never fabricated). Used standalone in tight spaces and
// as the badge inside the ValidationEnvelope trigger.
// =============================================================================

import type { ConfidenceLevel } from "@/lib/types";
import { CONFIDENCE_COLORS, formatScore } from "@/lib/format";
import { cn } from "@/lib/cn";

const SHORT: Record<ConfidenceLevel, string> = {
  High: "High",
  Medium: "Med",
  Low: "Low",
};

export interface ConfidenceBadgeProps {
  level: ConfidenceLevel | null;
  score?: number | null;
  size?: "sm" | "md";
  className?: string;
}

export function ConfidenceBadge({ level, score, size = "sm", className }: ConfidenceBadgeProps) {
  const isNone = level === null;
  const color = isNone ? "#DC2626" : CONFIDENCE_COLORS[level];
  const label = isNone ? "None" : SHORT[level];
  const scoreText = !isNone && score != null ? ` ${formatScore(score)}` : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-2xs" : "px-2 py-0.5 text-xs",
        className,
      )}
      style={{ borderColor: color, color }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {isNone ? "No conf." : `${label}${scoreText}`}
    </span>
  );
}
