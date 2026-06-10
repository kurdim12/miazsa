// =============================================================================
// pages/Login.tsx — Supabase email/password sign-in / sign-up (docs/12 §1.2).
//
// On success, route to the page the user came from (or `/`). Public data is
// readable without an account; this is for analyst actions and the route guard.
// =============================================================================

import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ScientificStanceNote } from "@/components/ScientificStanceNote";
import { t } from "@/lib/i18n";

type Mode = "signin" | "signup";

interface LocationState {
  from?: string;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!isSupabaseConfigured) {
      setError(t("state.notConfigured.body"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate(from, { replace: true });
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (data.session) {
          navigate(from, { replace: true });
        } else {
          setNotice(t("login.checkEmail"));
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("login.title")}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t("login.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium">
                {t("login.email")}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:ring-2"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-medium">
                {t("login.password")}
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:ring-2"
              />
            </div>

            {error && (
              <p className="rounded bg-brand-crimson/10 px-3 py-2 text-xs text-brand-crimson" aria-live="polite">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded bg-confidence-high/10 px-3 py-2 text-xs text-confidence-high" aria-live="polite">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand-cobalt px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy
                ? t("login.working")
                : mode === "signin"
                  ? t("login.signin")
                  : t("login.signup")}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setError(null);
              setNotice(null);
            }}
            className="mt-3 w-full text-center text-xs text-brand-cobalt underline"
          >
            {mode === "signin" ? t("login.toggleToSignup") : t("login.toggleToSignin")}
          </button>
        </CardContent>
      </Card>

      <ScientificStanceNote />
    </div>
  );
}
