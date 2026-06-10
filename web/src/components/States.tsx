// =============================================================================
// components/States.tsx — Loading / Empty / Error states (docs/13 §A.6).
//
// Empty state carries the contract's honest message: "No grounded data yet for
// this region/period — run an EE compute". Error state offers retry. Loading
// uses a reduced-motion-friendly pulse.
// =============================================================================

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";

export function LoadingState({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-brand-cobalt" />
      {label ?? t("state.loading")}
    </div>
  );
}

/** Skeleton card used while metric grids load. */
export function MetricCardSkeleton({ className }: { className?: string }) {
  return <div className={cn("h-24 w-full animate-pulse rounded-xl bg-muted", className)} />;
}

export function EmptyState({
  title,
  body,
  icon,
  action,
  className,
}: {
  title?: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <h3 className="text-sm font-semibold">{title ?? t("state.empty.title")}</h3>
      <p className="max-w-md text-xs text-muted-foreground">{body ?? t("state.empty.body")}</p>
      {action}
    </Card>
  );
}

export function ErrorState({
  title,
  message,
  retry,
  className,
}: {
  title?: string;
  message?: string;
  retry?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      <h3 className="text-sm font-semibold text-brand-crimson">{title ?? t("state.error.title")}</h3>
      {message && <p className="max-w-md text-xs text-muted-foreground" aria-live="polite">{message}</p>}
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="mt-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          {t("state.retry")}
        </button>
      )}
    </Card>
  );
}
