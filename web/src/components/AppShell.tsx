// =============================================================================
// components/AppShell.tsx — Application shell (docs/13 §A.3).
//
// Sticky top nav (National / Map / Azraq), app version, sign-in/out, the global
// SyntheticDataBanner (driven by DemoDataContext), and a persistent
// ScientificStanceNote in the footer. <Outlet /> renders the active page.
// =============================================================================

import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { SyntheticDataBanner } from "@/components/SyntheticDataBanner";
import { ScientificStanceNote } from "@/components/ScientificStanceNote";
import { useHasDemoData } from "@/components/DemoDataContext";
import { useSession } from "@/lib/useSession";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "0.1.0";
const APP_ENV = import.meta.env.VITE_APP_ENV || "local";

const NAV = [
  { to: "/", label: t("nav.dashboard"), end: true },
  { to: "/map", label: t("nav.map"), end: false },
  { to: "/azraq", label: t("nav.azraq"), end: false },
];

function navClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-brand-cobalt text-white"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export function AppShell() {
  const hasDemo = useHasDemoData();
  const { session } = useSession();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4" aria-label="Primary">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-brand-cobalt">
              {t("app.name")}
            </span>
            <span className="hidden text-2xs text-muted-foreground sm:inline">
              {t("app.tagline")}
            </span>
          </NavLink>

          <div className="ml-4 flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span
              className="hidden rounded bg-muted px-2 py-0.5 text-2xs font-mono text-muted-foreground md:inline"
              title="App version / environment"
            >
              v{APP_VERSION} · {APP_ENV}
            </span>
            {session ? (
              <button
                type="button"
                onClick={signOut}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                {t("nav.signout")}
              </button>
            ) : (
              <NavLink
                to="/login"
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                {t("nav.login")}
              </NavLink>
            )}
          </div>
        </nav>
        <SyntheticDataBanner visible={hasDemo} />
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl space-y-2 px-4 py-4">
          <ScientificStanceNote />
          <p className="text-2xs text-muted-foreground">
            {t("app.name")} v{APP_VERSION} · {t("footer.data")} · © 2026 · {t("footer.country")}
          </p>
        </div>
      </footer>
    </div>
  );
}
