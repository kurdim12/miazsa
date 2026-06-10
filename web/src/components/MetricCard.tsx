// =============================================================================
// components/MetricCard.tsx — Indicator value card (docs/13 §D.1, wireframes).
//
// Shows: label, value + unit, a ConfidenceBadge, and a ValidationEnvelope
// trigger. Honest empty state when there is no grounded value (contract:
// NEVER render placeholder/fake numbers). Synthetic demo values are marked.
// =============================================================================

import type { ValidationEnvelopeData } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { ValidationEnvelope } from "@/components/ValidationEnvelope";
import { formatValue } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";

export interface MetricCardProps {
  /** Display label (e.g. "Precipitation"). */
  label: string;
  /** The envelope view-model; `null` means no grounded data (empty state). */
  envelope: ValidationEnvelopeData | null;
  /** Optional sub-label (e.g. indicator code or category). */
  sublabel?: string;
  className?: string;
}

export function MetricCard({ label, envelope, sublabel, className }: MetricCardProps) {
  const hasValue =
    envelope !== null && envelope.value !== null && envelope.value !== undefined;

  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {sublabel && (
            <p className="font-mono text-2xs text-muted-foreground/70">{sublabel}</p>
          )}
        </div>
        {hasValue && <ValidationEnvelope data={envelope} variant="badge" align="end" />}
      </div>

      <div className="px-4 pb-3 pt-1">
        {hasValue ? (
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold tabular-nums">
              {formatValue(envelope.value)}
            </span>
            {envelope.unit && envelope.unit !== "1" && (
              <span className="text-xs text-muted-foreground">{envelope.unit}</span>
            )}
            {envelope.isDemo && (
              <span className="ml-1 rounded bg-brand-crimson/10 px-1 py-0.5 text-2xs font-semibold text-brand-crimson">
                demo
              </span>
            )}
          </div>
        ) : (
          <p className="py-1 text-xs text-muted-foreground">{t("state.empty.body")}</p>
        )}
      </div>
    </Card>
  );
}
