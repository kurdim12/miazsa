// =============================================================================
// src/lib/queryClient.ts — TanStack Query client + typed query keys.
//
// Cache policy mirrors docs/13 §E.3:
//   - indicators / risk: staleTime 15 min, gcTime 1 hr
//   - provenance / confidence: immutable once written (Infinity)
//   - alerts: 1 min, refetch on focus
// =============================================================================

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 15 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

/** Stable query keys (docs/13 §E.3). */
export const queryKeys = {
  regions: ["regions"] as const,
  region: (code: string) => ["region", code] as const,
  indicators: (regionId: string) => ["indicators", regionId] as const,
  indicatorSeries: (regionId: string, code: string) =>
    ["indicatorSeries", regionId, code] as const,
  latestRisk: (regionId: string) => ["risk", regionId] as const,
  alerts: (regionId: string | null) => ["alerts", regionId ?? "all"] as const,
  confidence: (kind: string, id: string) => ["confidence", kind, id] as const,
};
