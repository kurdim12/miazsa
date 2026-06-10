// =============================================================================
// components/DemoDataContext.tsx — Tracks whether any displayed metric is demo.
//
// Pages call `useReportDemo(true)` when they detect a metric whose provenance
// source starts with "ILLUSTRATIVE DEMO" (contract demo-data rule). The AppShell
// reads `useHasDemoData()` to show the global SyntheticDataBanner.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface DemoDataContextValue {
  hasDemo: boolean;
  /** Register/deregister demo presence for a stable source key. */
  setDemoForKey: (key: string, present: boolean) => void;
}

const DemoDataContext = createContext<DemoDataContextValue | null>(null);

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const keysRef = useRef<Set<string>>(new Set());
  const [hasDemo, setHasDemo] = useState(false);

  const setDemoForKey = useCallback((key: string, present: boolean) => {
    const set = keysRef.current;
    const before = set.size;
    if (present) set.add(key);
    else set.delete(key);
    if (set.size !== before) setHasDemo(set.size > 0);
  }, []);

  const value = useMemo<DemoDataContextValue>(
    () => ({ hasDemo, setDemoForKey }),
    [hasDemo, setDemoForKey],
  );

  return <DemoDataContext.Provider value={value}>{children}</DemoDataContext.Provider>;
}

export function useHasDemoData(): boolean {
  const ctx = useContext(DemoDataContext);
  return ctx?.hasDemo ?? false;
}

/**
 * Report demo-data presence for the current view. Registers under a key on mount
 * /update and clears it on unmount, so the banner reflects the active page.
 */
export function useReportDemo(present: boolean, key = "default"): void {
  const ctx = useContext(DemoDataContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setDemoForKey(key, present);
    return () => ctx.setDemoForKey(key, false);
  }, [ctx, key, present]);
}
