"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuickAddPhase } from "@/lib/quick-add";

export function QuickAddCta({
  phase,
  label,
  disabled,
  onClick,
  className,
}: {
  phase: QuickAddPhase;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const busy = phase === "submitting";
  const done = phase === "done";
  const locked = disabled || busy || done || phase === "idle";

  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      aria-busy={busy}
      className={cn(
        "quick-add-motion inline-flex h-10 w-full items-center justify-center gap-2 bg-choc px-3 font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-cream transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {busy ? (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cream/30 border-t-cream"
          aria-hidden
        />
      ) : null}
      {done ? <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> : null}
      <span>{label}</span>
    </button>
  );
}
