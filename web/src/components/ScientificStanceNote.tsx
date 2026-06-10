// =============================================================================
// components/ScientificStanceNote.tsx — Persistent integrity note.
//
// Contract / docs/08 §0: MIZAN ESTIMATES indicators from EO proxies; it does NOT
// claim direct groundwater/well/pressure observation or any legal determination.
// Shown persistently (compact in the shell footer; `prominent` on pages).
// =============================================================================

import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";

export function ScientificStanceNote({
  prominent = false,
  className,
}: {
  prominent?: boolean;
  className?: string;
}) {
  if (prominent) {
    return (
      <aside
        className={cn(
          "rounded-lg border border-brand-amber/30 bg-brand-amber/10 p-3 text-xs text-brand-amber-900 dark:text-brand-amber",
          className,
        )}
        aria-label={t("stance.title")}
      >
        <p className="font-semibold">{t("stance.title")}</p>
        <p className="mt-1 leading-relaxed">{t("stance.body")}</p>
      </aside>
    );
  }
  return (
    <p className={cn("text-2xs leading-relaxed text-muted-foreground", className)}>
      <span className="font-semibold">{t("stance.title")}:</span> {t("stance.body")}
    </p>
  );
}
