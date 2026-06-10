// =============================================================================
// components/StressClassBadge.tsx — gw_stress_class pill (docs/13 §B.5).
// Low -> green, Moderate -> yellow, High -> orange, Severe -> red (docs/08 §4).
// =============================================================================

import type { GwStressClass } from "@/lib/types";
import { STRESS_COLORS, formatValue, isNearThreshold } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface StressClassBadgeProps {
  stressClass: GwStressClass;
  index?: number | null;
  showIndex?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StressClassBadge({
  stressClass,
  index,
  showIndex = false,
  size = "md",
  className,
}: StressClassBadgeProps) {
  const color = STRESS_COLORS[stressClass];
  const near = typeof index === "number" && isNearThreshold(index);
  const sizeCls =
    size === "lg"
      ? "px-3 py-1 text-sm"
      : size === "sm"
        ? "px-1.5 py-0.5 text-2xs"
        : "px-2 py-0.5 text-xs";

  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full font-semibold text-white", sizeCls, className)}
      style={{ backgroundColor: color }}
      title={near ? "Near a class threshold — interpret with care" : undefined}
    >
      {stressClass.toUpperCase()}
      {showIndex && index != null && <span className="font-bold">{formatValue(index)}</span>}
      {near && <span aria-hidden="true">·≈</span>}
    </span>
  );
}
