// =============================================================================
// components/Protected.tsx — Route guard using the Supabase session.
//
// Public read pages (/, /map, /azraq) do NOT need this — RLS grants anon SELECT
// (docs/11), so viewers/judges read public data freely. This guard exists for
// routes that require an authenticated session; unauthenticated users are sent
// to /login with a return path.
// =============================================================================

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/lib/useSession";
import { LoadingState } from "@/components/States";

export function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();

  if (loading) return <LoadingState />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
