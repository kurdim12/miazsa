// =============================================================================
// components/SyntheticDataBanner.tsx — Global synthetic-data warning.
//
// Contract: if ANY displayed metric's provenance.source starts with
// "ILLUSTRATIVE DEMO" (synthetic local seed), render a prominent global banner
// and never present those metrics as real. Rendered in the AppShell; visibility
// is driven by the demo-data context.
// =============================================================================

import { t } from "@/lib/i18n";

export function SyntheticDataBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 border-b border-brand-crimson/30 bg-brand-crimson/10 px-4 py-2 text-xs text-brand-crimson"
    >
      <span aria-hidden="true" className="font-bold">
        ⚠
      </span>
      <p>
        <span className="font-semibold">Illustrative demo data.</span> {t("demo.banner")}
      </p>
    </div>
  );
}
