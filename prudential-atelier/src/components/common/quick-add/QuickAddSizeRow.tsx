"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ProductListVariant } from "@/types/product";

export function QuickAddSizeRow({
  variants,
  selectedId,
  onSelect,
  autoFocus,
  compact,
}: {
  variants: ProductListVariant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstEnabled = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoFocus) firstEnabled.current?.focus();
  }, [autoFocus]);

  return (
    <div
      ref={scrollerRef}
      role="radiogroup"
      aria-label="Size"
      className={cn(
        "min-w-0 w-full",
        compact
          ? "flex flex-wrap gap-2"
          : "quick-add-size-scroller flex min-w-0 gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-1",
      )}
    >
      {variants.map((v, i) => {
        const oos = v.stock < 1;
        const selected = selectedId === v.id;
        const isFirstEnabled = !oos && variants.findIndex((x) => x.stock > 0) === i;
        return (
          <button
            key={v.id}
            ref={isFirstEnabled ? firstEnabled : undefined}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={oos}
            aria-label={oos ? `${v.size}, unavailable` : v.size}
            tabIndex={oos ? -1 : selected || (!selectedId && isFirstEnabled) ? 0 : -1}
            disabled={oos}
            onClick={() => {
              if (!oos) onSelect(v.id);
            }}
            onKeyDown={(e) => {
              if (oos) return;
              const enabled = variants.filter((x) => x.stock > 0);
              const idx = enabled.findIndex((x) => x.id === v.id);
              if (idx < 0) return;
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                const next = enabled[(idx + 1) % enabled.length];
                onSelect(next.id);
                requestAnimationFrame(() => {
                  scrollerRef.current
                    ?.querySelector<HTMLButtonElement>(`[data-size-id="${next.id}"]`)
                    ?.focus();
                });
              }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                const prev = enabled[(idx - 1 + enabled.length) % enabled.length];
                onSelect(prev.id);
                requestAnimationFrame(() => {
                  scrollerRef.current
                    ?.querySelector<HTMLButtonElement>(`[data-size-id="${prev.id}"]`)
                    ?.focus();
                });
              }
            }}
            data-size-id={v.id}
            className={cn(
              "quick-add-motion border font-sans uppercase tracking-[0.08em] transition-colors duration-200",
              compact
                ? "box-border h-11 w-11 shrink-0 scroll-mb-28 p-0 text-[11px]"
                : "min-h-8 min-w-8 shrink-0 px-2.5 py-1 text-[10px]",
              selected
                ? "border-choc bg-choc text-cream"
                : "border-sand bg-bg-card text-choc",
              oos && "cursor-not-allowed border-sand/70 bg-transparent text-text-light line-through",
              !oos && !selected && "hover:border-choc",
            )}
          >
            {v.size}
          </button>
        );
      })}
    </div>
  );
}
