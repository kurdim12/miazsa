// =============================================================================
// src/lib/hooks.ts — TanStack Query hooks over the api module.
//
// Centralizes the read queries used by the pages with the cache policy from
// docs/13 §E.3. Keeps components declarative and consistent.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import {
  getAlerts,
  getIndicatorSeries,
  getIndicatorValues,
  getLatestRisk,
  getRegionByCode,
  getRegions,
  getRiskHistory,
} from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { queryKeys } from "@/lib/queryClient";

export function useRegions() {
  return useQuery({
    queryKey: queryKeys.regions,
    queryFn: getRegions,
    enabled: isSupabaseConfigured,
  });
}

export function useRegionByCode(code: string) {
  return useQuery({
    queryKey: queryKeys.region(code),
    queryFn: () => getRegionByCode(code),
    enabled: isSupabaseConfigured,
  });
}

export function useIndicatorValues(regionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.indicators(regionId ?? ""),
    queryFn: () => getIndicatorValues(regionId as string),
    enabled: isSupabaseConfigured && Boolean(regionId),
  });
}

export function useIndicatorSeries(regionId: string | undefined, code: string) {
  return useQuery({
    queryKey: queryKeys.indicatorSeries(regionId ?? "", code),
    queryFn: () => getIndicatorSeries(regionId as string, code),
    enabled: isSupabaseConfigured && Boolean(regionId),
  });
}

export function useLatestRisk(regionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.latestRisk(regionId ?? ""),
    queryFn: () => getLatestRisk(regionId as string),
    enabled: isSupabaseConfigured && Boolean(regionId),
  });
}

export function useRiskHistory(regionId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.latestRisk(regionId ?? ""), "history"],
    queryFn: () => getRiskHistory(regionId as string),
    enabled: isSupabaseConfigured && Boolean(regionId),
  });
}

export function useAlerts(regionId?: string) {
  return useQuery({
    queryKey: queryKeys.alerts(regionId ?? null),
    queryFn: () => getAlerts(regionId),
    enabled: isSupabaseConfigured,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
