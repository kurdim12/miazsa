// =============================================================================
// components/ValidationEnvelope.tsx — MIZAN's ubiquitous transparency affordance.
//
// Shows the five Validation Envelope fields (docs/09 §1; docs/13 §B.1):
//   Source · Date · Methodology · Confidence · Explanation
// MUST appear on every displayed metric. Three variants:
//   - badge  : a clickable ConfidenceBadge that opens the popover
//   - icon   : an info-icon trigger (tight spaces / chart tooltips / map cells)
//   - inline : the full card rendered inline (reports / detail views)
// Synthetic demo metrics are clearly flagged (contract demo-data rule).
// =============================================================================

import type { ValidationEnvelopeData } from "@/lib/types";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { Popover } from "@/components/ui/Popover";
import { formatDate, formatScore, formatWithUnit } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";

export interface ValidationEnvelopeProps {
  data: ValidationEnvelopeData;
  variant?: "badge" | "icon" | "inline";
  align?: "start" | "end";
  className?: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 py-1 text-xs">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="text-card-foreground">{children}</dd>
    </div>
  );
}

/** The shared body (used by the popover and by the inline variant). */
function EnvelopeBody({ data }: { data: ValidationEnvelopeData }) {
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("env.title")}
        </span>
        {data.isDemo && (
          <span className="rounded bg-brand-crimson/10 px-1.5 py-0.5 text-2xs font-semibold text-brand-crimson">
            DEMO
          </span>
        )}
      </div>

      <dl>
        <Field label={t("env.metric")}>
          <code className="font-mono text-2xs">{data.metricCode}</code>
        </Field>
        <Field label={t("env.value")}>
          <span className="font-semibold">{formatWithUnit(data.value, data.unit)}</span>
        </Field>
      </dl>

      <div className="my-2 border-t border-border" />

      <dl>
        <Field label={t("env.source")}>{data.source}</Field>
        <Field label={t("env.date")}>{formatDate(data.date)}</Field>
        <Field label={t("env.methodology")}>{data.methodology}</Field>
        <Field label={t("env.confidence")}>
          {data.confidenceLevel ? (
            <span className="inline-flex items-center gap-2">
              <ConfidenceBadge level={data.confidenceLevel} score={data.confidenceScore} />
              {data.confidenceScore != null && (
                <span className="text-muted-foreground">{formatScore(data.confidenceScore)}</span>
              )}
            </span>
          ) : (
            <span className="text-brand-crimson">{t("env.noConfidence")}</span>
          )}
        </Field>
        <Field label={t("env.explanation")}>{data.explanation}</Field>
      </dl>

      {data.attribution && (
        <p className="mt-2 border-t border-border pt-2 text-2xs text-muted-foreground">
          {data.attribution}
        </p>
      )}
      {data.isDemo && (
        <p className="mt-2 rounded bg-brand-crimson/10 p-2 text-2xs text-brand-crimson">
          {t("env.demoFlag")}
        </p>
      )}
    </div>
  );
}

export function ValidationEnvelope({
  data,
  variant = "badge",
  align = "start",
  className,
}: ValidationEnvelopeProps) {
  if (variant === "inline") {
    return (
      <div
        className={cn("rounded-lg border border-border bg-card text-card-foreground", className)}
      >
        <EnvelopeBody data={data} />
      </div>
    );
  }

  const ariaLabel = `${t("env.trigger")} for ${data.metricCode}`;

  return (
    <Popover
      label={`${t("env.title")} — ${data.metricCode}`}
      align={align}
      className={className}
      trigger={(p) =>
        variant === "icon" ? (
          <button
            type="button"
            {...p}
            aria-label={ariaLabel}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-2xs font-bold text-muted-foreground hover:bg-muted focus-visible:ring-2"
          >
            i
          </button>
        ) : (
          <button
            type="button"
            {...p}
            aria-label={ariaLabel}
            className="inline-flex items-center rounded-full transition hover:opacity-80 focus-visible:ring-2"
          >
            <ConfidenceBadge level={data.confidenceLevel} score={data.confidenceScore} />
          </button>
        )
      }
    >
      <EnvelopeBody data={data} />
    </Popover>
  );
}
