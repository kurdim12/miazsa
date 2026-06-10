// =============================================================================
// pages/AzraqIntelligence.tsx — `/azraq` (docs/13 §C.3). The demo showcase.
//
// - Hero: gw_stress_index RadialGauge + StressClassBadge + ValidationEnvelope.
// - Sub-index breakdown: the five sub-indices from risk_scores.components, with
//   active weights + contributions (docs/08 §2/§3/§5), each carrying an envelope
//   that inherits the risk score's provenance/confidence.
// - Key indicator MetricCards (each with a ValidationEnvelope).
// - TimeSeriesChart for precip_mm and NDVI (envelope on title).
// - "Run analysis": calls the risk-score Edge Function (docs/12 §3.2) to
//   recompute the index (analyst role; surfaces FORBIDDEN honestly for viewers).
// - Honest empty states; scientific-stance footer.
// =============================================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AZRAQ_CODE, callRiskScore, ApiError } from "@/lib/api";
import {
  useIndicatorSeries,
  useIndicatorValues,
  useLatestRisk,
  useRegionByCode,
  useRiskHistory,
} from "@/lib/hooks";
import { queryClient, queryKeys } from "@/lib/queryClient";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useReportDemo } from "@/components/DemoDataContext";
import { MetricCard } from "@/components/MetricCard";
import { StressClassBadge } from "@/components/StressClassBadge";
import { RadialGauge } from "@/components/RadialGauge";
import { ValidationEnvelope } from "@/components/ValidationEnvelope";
import { TimeSeriesChart, type SeriesPoint } from "@/components/TimeSeriesChart";
import { ScientificStanceNote } from "@/components/ScientificStanceNote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { envelopeForDerived, envelopeForIndicator, envelopeForRisk } from "@/lib/envelope";
import {
  RISK_KEYS,
  RISK_LABELS,
  STRESS_COLORS,
  formatDate,
  formatValue,
  isDemoProvenance,
} from "@/lib/format";
import { t } from "@/lib/i18n";
import type { IndicatorValue, RiskComponentKey, RiskScore } from "@/lib/types";

/** Key indicator codes shown as MetricCards (docs/13 §C.3 tabs, condensed). */
const KEY_INDICATOR_CODES = [
  "ndvi",
  "ndwi",
  "surface_water_extent_km2",
  "precip_mm",
  "spi_3",
  "spi_12",
  "et0_pm_mm",
  "irrigated_area_ha",
  "agri_expansion_pct",
  "recharge_proxy_mm",
  "abstraction_estimate_mcm",
  "water_balance_mcm",
];

function pick(values: IndicatorValue[] | undefined, code: string): IndicatorValue | undefined {
  return values?.find((v) => v.indicators?.code === code);
}

export default function AzraqIntelligence() {
  const regionQ = useRegionByCode(AZRAQ_CODE);
  const azraqId = regionQ.data?.id;

  const riskQ = useLatestRisk(azraqId);
  const valuesQ = useIndicatorValues(azraqId);
  const historyQ = useRiskHistory(azraqId);
  const precipQ = useIndicatorSeries(azraqId, "precip_mm");
  const ndviQ = useIndicatorSeries(azraqId, "ndvi");

  const { session } = useSession();
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const hasDemo = useMemo(() => {
    const fromRisk = isDemoProvenance(riskQ.data?.provenance ?? null);
    const fromValues = (valuesQ.data ?? []).some((v) => isDemoProvenance(v.provenance ?? null));
    return fromRisk || fromValues;
  }, [riskQ.data, valuesQ.data]);
  useReportDemo(hasDemo, "azraq");

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!azraqId || !riskQ.data) {
        throw new ApiError("UNPROCESSABLE", "No existing risk period to recompute.");
      }
      return callRiskScore(azraqId, {
        start: riskQ.data.period_start,
        end: riskQ.data.period_end,
      });
    },
    onSuccess: (env) => {
      setRunMsg(
        `Recomputed: ${env.data.gw_stress_index.toFixed(1)} (${env.data.gw_stress_class}).`,
      );
      if (azraqId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.latestRisk(azraqId) });
      }
    },
    onError: (e) => {
      const err = e as ApiError;
      setRunMsg(
        err.code === "FORBIDDEN"
          ? "Run analysis requires an analyst role. Showing stored results only."
          : `Could not run analysis: ${err.message}`,
      );
    },
  });

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("azraq.title")}</h1>
        <EmptyState title={t("state.notConfigured.title")} body={t("state.notConfigured.body")} />
      </div>
    );
  }

  const riskEnv = riskQ.data ? envelopeForRisk(riskQ.data) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("azraq.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("azraq.subtitle")}</p>
          {riskQ.data && (
            <p className="text-2xs text-muted-foreground">
              {t("azraq.lastUpdated")}: {formatDate(riskQ.data.period_end)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending || !riskQ.data}
              className="rounded-md bg-brand-cobalt px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              title={t("azraq.runHint")}
            >
              {runMutation.isPending ? t("azraq.running") : t("azraq.runAnalysis")}
            </button>
          </div>
          {!session && (
            <p className="text-2xs text-muted-foreground">{t("azraq.runHint")}</p>
          )}
          {runMsg && (
            <p className="max-w-xs text-right text-2xs text-muted-foreground" aria-live="polite">
              {runMsg}
            </p>
          )}
        </div>
      </header>

      {/* Hero: gauge + class + envelope */}
      <Card>
        <CardContent className="pt-4">
          {riskQ.isLoading ? (
            <LoadingState />
          ) : riskQ.isError ? (
            <ErrorState message={(riskQ.error as Error).message} retry={() => riskQ.refetch()} />
          ) : riskQ.data && riskEnv ? (
            <div className="flex flex-wrap items-center gap-6">
              <RadialGauge value={riskQ.data.gw_stress_index} label="gw_stress_index" />
              <div className="space-y-2">
                <StressClassBadge
                  stressClass={riskQ.data.gw_stress_class}
                  index={riskQ.data.gw_stress_index}
                  size="lg"
                />
                <div>
                  <ValidationEnvelope data={riskEnv} variant="inline" className="max-w-md" />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              action={
                <Link to="/" className="text-xs text-brand-cobalt underline">
                  Back to National
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Sub-index breakdown */}
      {riskQ.data && (
        <SubIndexBreakdown risk={riskQ.data} />
      )}

      {/* Key indicators grid */}
      <section aria-label={t("azraq.indicators")} className="space-y-2">
        <h2 className="text-sm font-semibold">{t("azraq.indicators")}</h2>
        {valuesQ.isLoading ? (
          <LoadingState />
        ) : valuesQ.isError ? (
          <ErrorState message={(valuesQ.error as Error).message} retry={() => valuesQ.refetch()} />
        ) : (valuesQ.data?.length ?? 0) === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {KEY_INDICATOR_CODES.map((code) => {
              const iv = pick(valuesQ.data, code);
              // Only render cards for indicators that have a grounded value.
              if (!iv) return null;
              return (
                <MetricCard
                  key={code}
                  label={iv.indicators?.name_en ?? code}
                  sublabel={code}
                  envelope={envelopeForIndicator(iv)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Trends */}
      <section aria-label={t("azraq.trends")} className="space-y-2">
        <h2 className="text-sm font-semibold">{t("azraq.trends")}</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SeriesPanel
            title="Precipitation (precip_mm)"
            color="#1D4ED8"
            seriesKey="precip_mm"
            isLoading={precipQ.isLoading}
            isError={precipQ.isError}
            error={precipQ.error as Error | null}
            data={precipQ.data ?? []}
            refetch={() => precipQ.refetch()}
          />
          <SeriesPanel
            title="Vegetation (NDVI)"
            color="#16A34A"
            seriesKey="ndvi"
            isLoading={ndviQ.isLoading}
            isError={ndviQ.isError}
            error={ndviQ.error as Error | null}
            data={ndviQ.data ?? []}
            refetch={() => ndviQ.refetch()}
          />
        </div>
      </section>

      {/* Water balance note */}
      <Card>
        <CardHeader>
          <CardTitle>{t("azraq.balance")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {["recharge_proxy_mm", "abstraction_estimate_mcm", "water_balance_mcm"].map((code) => {
              const iv = pick(valuesQ.data, code);
              return (
                <MetricCard
                  key={code}
                  label={iv?.indicators?.name_en ?? code}
                  sublabel={code}
                  envelope={iv ? envelopeForIndicator(iv) : null}
                />
              );
            })}
          </div>
          <p className="rounded bg-brand-amber/10 px-3 py-2 text-2xs text-brand-amber-900 dark:text-brand-amber">
            {t("azraq.balance.note")}
          </p>
        </CardContent>
      </Card>

      {/* Risk history */}
      {historyQ.data && historyQ.data.length > 0 && (
        <RiskHistoryChart history={historyQ.data} />
      )}

      <ScientificStanceNote prominent />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-index breakdown (docs/08 §2/§3/§5). Reads risk_scores.components; each
// sub-index shows value, active weight, and contribution (= weight × value).
// ---------------------------------------------------------------------------
function SubIndexBreakdown({ risk }: { risk: RiskScore }) {
  const present = RISK_KEYS.filter((k) => risk.components[k] != null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("azraq.subindices")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xs text-muted-foreground">{t("azraq.subindices.note")}</p>
        {present.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No sub-index components recorded for this score.
          </p>
        ) : (
          <ul className="space-y-2">
            {present.map((key) => {
              const comp = risk.components[key]!;
              const contribution = comp.weight * comp.value;
              const env = envelopeForDerived(key as RiskComponentKey, comp.value, "0–100", risk);
              return (
                <li key={key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{RISK_LABELS[key]}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span>w={comp.weight.toFixed(2)}</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatValue(comp.value)}
                      </span>
                      <ValidationEnvelope data={env} variant="icon" align="end" />
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, comp.value))}%`,
                        backgroundColor: STRESS_COLORS[risk.gw_stress_class],
                      }}
                    />
                  </div>
                  <p className="text-2xs text-muted-foreground">
                    Contribution to index: {contribution.toFixed(1)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// A single indicator time-series panel.
// ---------------------------------------------------------------------------
function SeriesPanel({
  title,
  color,
  seriesKey,
  data,
  isLoading,
  isError,
  error,
  refetch,
}: {
  title: string;
  color: string;
  seriesKey: string;
  data: IndicatorValue[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}) {
  if (isLoading) return <Card><CardContent className="pt-4"><LoadingState /></CardContent></Card>;
  if (isError)
    return (
      <Card>
        <CardContent className="pt-4">
          <ErrorState message={error?.message} retry={refetch} />
        </CardContent>
      </Card>
    );

  const points: SeriesPoint[] = data.map((iv) => ({ date: iv.obs_date, [seriesKey]: iv.value }));
  const last = data[data.length - 1];
  const env = last ? envelopeForIndicator(last) : null;
  const unit = last?.indicators?.unit;
  const attribution =
    last?.provenance?.datasets?.attribution ?? last?.provenance?.source ?? undefined;

  return (
    <TimeSeriesChart
      title={title}
      data={points}
      series={[{ key: seriesKey, label: title, color, unit }]}
      envelope={env}
      sourceNote={attribution ? `Source: ${attribution}` : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Risk history chart (gw_stress_index over time).
// ---------------------------------------------------------------------------
function RiskHistoryChart({ history }: { history: RiskScore[] }) {
  const points: SeriesPoint[] = history.map((r) => ({
    date: r.period_end,
    gw_stress_index: r.gw_stress_index,
  }));
  const last = history[history.length - 1];
  const env = last ? envelopeForRisk(last) : null;
  return (
    <section aria-label="Groundwater stress history">
      <TimeSeriesChart
        title="Groundwater stress history (gw_stress_index)"
        data={points}
        series={[{ key: "gw_stress_index", label: "GW stress index", color: "#EA580C" }]}
        envelope={env}
        height={200}
      />
    </section>
  );
}
