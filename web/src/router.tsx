// =============================================================================
// src/router.tsx — Route table (docs/13 §E.1, adapted to the slice's pages).
//
// `/login` is public; `/`, `/map`, `/azraq` are readable (RLS grants anon SELECT
// so viewer/judge can read public data). Pages are lazy-loaded for route-level
// code splitting (docs/13 §F.1). The heavy map/chart libs live in their own
// chunks via vite.config manualChunks.
// =============================================================================

import { lazy, Suspense } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { LoadingState, ErrorState } from "@/components/States";

const NationalCommandCenter = lazy(() => import("@/pages/NationalCommandCenter"));
const JordanMap = lazy(() => import("@/pages/JordanMap"));
const AzraqIntelligence = lazy(() => import("@/pages/AzraqIntelligence"));
const Login = lazy(() => import("@/pages/Login"));

function withSuspense(node: React.ReactNode): React.ReactElement {
  return <Suspense fallback={<LoadingState />}>{node}</Suspense>;
}

const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: (
      <ErrorState
        title="Page error"
        message="This route failed to load. Use the navigation to continue."
      />
    ),
    children: [
      { index: true, element: withSuspense(<NationalCommandCenter />) },
      { path: "map", element: withSuspense(<JordanMap />) },
      { path: "azraq", element: withSuspense(<AzraqIntelligence />) },
      { path: "login", element: withSuspense(<Login />) },
    ],
  },
];

export const router = createBrowserRouter(routes);
