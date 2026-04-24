"use client";

import { cn } from "@/lib/utils";
import { useCurrencyStore } from "@/store/currencyStore";

const CURRENCIES = [
  { code: "NGN" as const, symbol: "₦" },
  { code: "USD" as const, symbol: "$" },
  { code: "GBP" as const, symbol: "£" },
];

export function CurrencySwitcher({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrencyStore();

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          type="button"
          onClick={() => setCurrency(c.code)}
          className={cn(
            "rounded-sm px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.1em] transition-all duration-150",
            currency === c.code ? "bg-wine text-ivory" : "text-charcoal-mid hover:text-wine",
          )}
          aria-pressed={currency === c.code}
          aria-label={`Switch to ${c.code}`}
        >
          {c.symbol} {c.code}
        </button>
      ))}
    </div>
  );
}
