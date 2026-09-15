"use client";

import { cn } from "@/lib/utils";

export function ProductOptionRow({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div id="product-options">
      <p id="product-options-label" className="mb-3 font-body text-sm font-normal text-charcoal">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby="product-options-label"
        className="flex flex-wrap gap-2"
      >
        {options.map((o, i) => {
          const selected = selectedId === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (!selectedId && i === 0) ? 0 : -1}
              onClick={() => onSelect(o.id)}
              className={cn(
                "inline-flex min-h-[44px] min-w-[44px] items-center justify-center border px-3 font-sans text-[11px] uppercase tracking-[0.08em] transition-colors duration-200 active:scale-[0.97]",
                selected
                  ? "border-choc bg-choc text-cream"
                  : "border-sand bg-bg-card text-choc hover:border-choc",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
