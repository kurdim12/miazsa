// =============================================================================
// components/ui/Popover.tsx — Minimal accessible click-popover.
//
// Opened by click (not hover) for accessibility (docs/13 §B.1). Escape closes;
// click-outside closes; focus returns to the trigger on close. No external
// dependency (the contract's dep list excludes Radix), so this is a small,
// self-contained implementation with the ARIA wiring the spec calls for.
// =============================================================================

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

export interface PopoverProps {
  /** Render-prop trigger; receives props to spread on a focusable element. */
  trigger: (args: {
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-controls": string;
    "aria-haspopup": "dialog";
  }) => ReactNode;
  children: ReactNode;
  /** Accessible label for the popover dialog. */
  label: string;
  align?: "start" | "end";
  className?: string;
}

export function Popover({ trigger, children, label, align = "start", className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerWrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        // Return focus to the trigger for keyboard users.
        triggerWrapRef.current?.querySelector<HTMLElement>("button,a,[tabindex]")?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <span ref={triggerWrapRef} className="inline-flex">
        {trigger({
          onClick: () => setOpen((v) => !v),
          "aria-expanded": open,
          "aria-controls": id,
          "aria-haspopup": "dialog",
        })}
      </span>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute top-full z-50 mt-2 max-h-[70vh] w-[22rem] max-w-[90vw] overflow-y-auto",
            "rounded-xl border border-border bg-card text-card-foreground shadow-xl",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
