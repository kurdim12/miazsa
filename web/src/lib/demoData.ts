// =============================================================================
// src/lib/demoData.ts — Demo-data context + hooks (non-component module).
//
// Tracks whether any displayed metric is synthetic "ILLUSTRATIVE DEMO" data so
// the AppShell can show the global SyntheticDataBanner (contract demo-data rule).
// The Provider component lives in components/DemoDataContext.tsx (kept separate
// so component files only export components — clean React Fast Refresh).
// =============================================================================

import { createContext, useContext, useEffect } from "react";

export interface DemoDataContextValue {
  hasDemo: boolean;
  /** Register/deregister demo presence for a stable source key. */
  setDemoForKey: (key: string, present: boolean) => void;
}

export const DemoDataContext = createContext<DemoDataContextValue | null>(null);

export function useHasDemoData(): boolean {
  const ctx = useContext(DemoDataContext);
  return ctx?.hasDemo ?? false;
}

/**
 * Report demo-data presence for the current view. Registers under a key on
 * mount/update and clears it on unmount, so the banner reflects the active page.
 */
export function useReportDemo(present: boolean, key = "default"): void {
  const ctx = useContext(DemoDataContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setDemoForKey(key, present);
    return () => ctx.setDemoForKey(key, false);
  }, [ctx, key, present]);
}
