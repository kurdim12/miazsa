// =============================================================================
// pages/JordanMap.tsx — `/map` (docs/13 §C.2).
//
// MapView (MapLibre + MapTiler) + a side panel showing the selected region's
// latest indicators and groundwater-stress estimate, each with a
// ValidationEnvelope. Regions are colored by their latest stress class (a
// choropleth); click a region to inspect it. Honest empty states throughout.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { getLatestRisk, AZRAQ_CODE } from "@/lib/api";
import { useIndicatorValues, useLatestRisk, useRegions } from "@/lib/hooks";
import { isSupabaseConfigured } from "@/lib/supabase";
import { queryKeys } from "@/lib/queryClient";
import { MapView, type MapRegionFeature } from "@/components/MapView";
import { MetricCard } from "@/components/MetricCard";
import { StressClassBadge } from "@/components/StressClassBadge";
import { ValidationEnvelope } from "@/components/ValidationEnvelope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { resolveRegionGeometry, isApproximateGeometry } from "@/lib/geo";
import { envelopeForIndicator, envelopeForRisk } from "@/lib/envelope";
import { STRESS_COLORS, isDemoProvenance } from "@/lib/format";
import { useReportDemo } from "@/components/DemoDataContext";
import { t } from "@/lib/i18n";
import type { Region, RiskScore } from "@/lib/types";

export default function JordanMap() {
  const regionsQ = useRegions();
  const regions = useMemo<Region[]>(() => regionsQ.data ?? [], [regionsQ.data]);

  // Fetch latest risk for every region to color the choropleth.
  const riskResults = useQueries({
    queries: regions.map((r) => ({
      queryKey: queryKeys.latestRisk(r.id),
      queryFn: () => getLatestRisk(r.id),
      enabled: isSupabaseConfigured && regions.length > 0,
    })),
  });

  const riskByRegion = useMemo(() => {
    const m = new Map<string, RiskScore | null>();
    regions.forEach((r, i) => m.set(r.id, riskResults[i]?.data ?? null));
    return m;
  }, [regions, riskResults]);

  const features = useMemo<MapRegionFeature[]>(
    () =>
      regions.map((r) => {
        const risk = riskByRegion.get(r.id) ?? null;
        return {
          id: r.id,
          name: r.name_en,
          geometry: resolveRegionGeometry(r),
          color: risk ? STRESS_COLORS[risk.gw_stress_class] : "#94A3B8",
        };
      }),
    [regions, riskByRegion],
  );

  // Default selection: Azraq if present, else first region.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId || regions.length === 0) return;
    const azraq = regions.find((r) => r.code === AZRAQ_CODE);
    setSelectedId(azraq?.id ?? regions[0]!.id);
  }, [regions, selectedId]);

  const selectedRegion = regions.find((r) => r.id === selectedId) ?? null;

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("map.title")}</h1>
        <EmptyState title={t("state.notConfigured.title")} body={t("state.notConfigured.body")} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("map.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("map.subtitle")}</p>
      </header>

      {regionsQ.isLoading ? (
        <LoadingState />
      ) : regionsQ.isError ? (
        <ErrorState message={(regionsQ.error as Error).message} retry={() => regionsQ.refetch()} />
      ) : regions.length === 0 ? (
        <EmptyState title="No regions" body="No analysis regions are available yet." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
          <Card className="overflow-hidden">
            <div className="h-[28rem] w-full lg:h-[34rem]">
              <MapView
                regions={features}
                selectedRegionId={selectedId}
                onSelectRegion={setSelectedId}
                ariaLabel="Jordan monitoring map; click a region to inspect it"
              />
            </div>
          </Card>

          <aside>
            {selectedRegion ? (
              <RegionPanel region={selectedRegion} />
            ) : (
              <EmptyState title={t("map.selectPrompt")} body="" />
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function RegionPanel({ region }: { region: Region }) {
  const riskQ = useLatestRisk(region.id);
  const valuesQ = useIndicatorValues(region.id);

  const hasDemo = useMemo(() => {
    const fromRisk = isDemoProvenance(riskQ.data?.provenance ?? null);
    const fromValues = (valuesQ.data ?? []).some((v) => isDemoProvenance(v.provenance ?? null));
    return fromRisk || fromValues;
  }, [riskQ.data, valuesQ.data]);
  useReportDemo(hasDemo, `map-panel-${region.id}`);

  const riskEnv = riskQ.data ? envelopeForRisk(riskQ.data) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{region.name_en}</CardTitle>
          {region.name_ar && (
            <p className="font-arabic text-xs text-muted-foreground" dir="rtl">
              {region.name_ar}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isApproximateGeometry(region) && (
            <p className="rounded bg-muted px-2 py-1 text-2xs text-muted-foreground">
              Boundary shown is an approximate AOI (seed geometry). Production loads authoritative
              boundaries.
            </p>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t("map.panel.risk")}</p>
            {riskQ.isLoading ? (
              <LoadingState className="py-3" />
            ) : riskQ.isError ? (
              <ErrorState message={(riskQ.error as Error).message} retry={() => riskQ.refetch()} />
            ) : riskQ.data && riskEnv ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tabular-nums">
                  {riskQ.data.gw_stress_index.toFixed(1)}
                </span>
                <StressClassBadge
                  stressClass={riskQ.data.gw_stress_class}
                  index={riskQ.data.gw_stress_index}
                />
                <ValidationEnvelope data={riskEnv} variant="badge" align="end" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("state.empty.body")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">{t("map.panel.indicators")}</p>
        {valuesQ.isLoading ? (
          <LoadingState />
        ) : valuesQ.isError ? (
          <ErrorState message={(valuesQ.error as Error).message} retry={() => valuesQ.refetch()} />
        ) : (valuesQ.data?.length ?? 0) === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {valuesQ.data!.slice(0, 8).map((iv) => (
              <MetricCard
                key={iv.id}
                label={iv.indicators?.name_en ?? iv.indicators?.code ?? "indicator"}
                sublabel={iv.indicators?.code}
                envelope={envelopeForIndicator(iv)}
              />
            ))}
          </div>
        )}
      </div>

      <Link
        to="/azraq"
        className="block rounded-md border border-border px-3 py-2 text-center text-sm font-medium hover:bg-muted"
      >
        {t("national.viewAzraq")}
      </Link>
    </div>
  );
}
