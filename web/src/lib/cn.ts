// =============================================================================
// src/lib/cn.ts — Tiny className combiner (no clsx/tailwind-merge dependency).
// Joins truthy class strings; later classes are not deduped (kept minimal).
// =============================================================================

export type ClassValue = string | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
