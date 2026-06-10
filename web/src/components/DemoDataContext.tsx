// =============================================================================
// components/DemoDataContext.tsx — Provider for the demo-data context.
//
// Holds the set of keys currently reporting synthetic demo data and exposes
// `hasDemo` to the AppShell's global SyntheticDataBanner. The context object and
// the consumer hooks live in lib/demoData.ts (so this file only exports a
// component — clean React Fast Refresh).
// =============================================================================

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DemoDataContext,
  type DemoDataContextValue,
} from "@/lib/demoData";

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
