// =============================================================================
// src/App.tsx — Providers + router (docs/13 §E).
//
// QueryClientProvider (TanStack Query) + DemoDataProvider (drives the global
// SyntheticDataBanner) + RouterProvider. The AppShell wraps all routes; viewer/
// judge can read public data without signing in.
// =============================================================================

import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { DemoDataProvider } from "@/components/DemoDataContext";
import { router } from "@/router";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DemoDataProvider>
        <RouterProvider router={router} />
      </DemoDataProvider>
    </QueryClientProvider>
  );
}
