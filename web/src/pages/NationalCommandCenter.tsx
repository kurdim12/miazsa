// =============================================================================
// pages/NationalCommandCenter.tsx — `/` (docs/13 §C.1).
//
// Executive dashboard: title, scientific stance, headline KPI cards for the
// Azraq gw_stress_index + key indicators (each with a ValidationEnvelope), and
// links to the Map and Azraq pages. Honest empty states throughout; no
// fabricated numbers. Surfaces the global SyntheticDataBanner if any value is
// illustrative demo data.
// =============================================================================

import { Link } from "react-router-dom";
import { useMemo } from "react";
import { AZRAQ_CODE } from "@/lib/api";
import { useIndicatorValues, useLatestRisk, useRegionByCode } from "@/lib/hooks";
import { useReportDemo } from "@/lib/demoData";
import { isSupabaseConfigured } from "@/lib/supabase";
import { MetricCard } from "@/components/MetricCard";
import { StressClassBadge } from "@/components/StressClassBadge";
import { ValidationEnvelope } from "@/components/ValidationEnvelope";
import { ScientificStanceNote } from "@/components/ScientificStanceNote";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { envelopeForIndicator, envelopeForRisk } from "@/lib/envelope";
import { isDemoProvenance } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { IndicatorValue } from "@/lib/types";

/** Headline indicator codes for the KPI strip. */
const HEADLINE_CODES = ["precip_mm", "ndvi", "irrigated_area_ha", "water_balance_mcm"];

function pick(values: IndicatorValue[] | undefined, code: string): IndicatorValue | undefined {
  return values?.find((v) => v.indicators?.code === code);
}

export default function NationalCommandCenter() {
  const regionQ = useRegionByCode(AZRAQ_CODE);
  const azraqId = regionQ.data?.id;
  const riskQ = useLatestRisk(azraqId);
  const valuesQ = useIndicatorValues(azraqId);

  const hasDemo = useMemo(() => {
    const fromRisk = isDemoProvenance(riskQ.data?.provenance ?? null);
    const fromValues = (valuesQ.data ?? []).some((v) => isDemoProvenance(v.provenance ?? null));
    return fromRisk || fromValues;
  }, [riskQ.data, valuesQ.data]);
  useReportDemo(hasDemo, "national");

  const riskEnv = riskQ.data ? envelopeForRisk(riskQ.data) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("national.title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("national.subtitle")}</p>
      </header>

      <ScientificStanceNote prominent />

      {!isSupabaseConfigured ? (
        <EmptyState title={t("state.notConfigured.title")} body={t("state.notConfigured.body")} />
      ) : (
        <>
          {/* Azraq headline risk card */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("national.azraqHeadline")}
                  </p>
                  {riskQ.isLoading ? (
                    <LoadingState className="py-4" />
                  ) : riskQ.isError ? (
                    <ErrorState
                      message={(riskQ.error as Error).message}
                      retry={() => riskQ.refetch()}
                    />
                  ) : riskQ.data && riskEnv ? (
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-4xl font-bold tabular-nums">
                        {riskQ.data.gw_stress_index.toFixed(1)}
                      </span>
                      <StressClassBadge
                        stressClass={riskQ.data.gw_stress_class}
                        index={riskQ.data.gw_stress_index}
                        size="lg"
                      />
                      <ValidationEnvelope data={riskEnv} variant="badge" />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">{t("state.empty.body")}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    to="/azraq"
                    className="rounded-md bg-brand-cobalt px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    {t("national.viewAzraq")}
                  </Link>
                  <Link
                    to="/map"
                    className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    {t("national.viewMap")}
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI strip — key indicators with envelopes */}
          <section aria-label="Key indicators">
            {valuesQ.isLoading ? (
              <LoadingState />
            ) : valuesQ.isError ? (
              <ErrorState
                message={(valuesQ.error as Error).message}
                retry={() => valuesQ.refetch()}
              />
            ) : (valuesQ.data?.length ?? 0) === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {HEADLINE_CODES.map((code) => {
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
            )}
          </section>
        </>
      )}
    </div>
  );
}
