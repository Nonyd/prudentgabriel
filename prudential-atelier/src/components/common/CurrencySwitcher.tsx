"use client";

import { cn } from "@/lib/utils";
import { useCurrencyStore } from "@/store/currencyStore";

const CURRENCIES = [
  { code: "NGN" as const, symbol: "₦" },
  { code: "USD" as const, symbol: "$" },
  { code: "GBP" as const, symbol: "£" },
];

export function CurrencySwitcher({
  className,
  variant = "default",
}: {
  className?: string;
  /** Navbar: symbol-only strip */
  variant?: "default" | "compact" | "compact-pills";
}) {
  const { currency, setCurrency } = useCurrencyStore();

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-0.5", className)} role="group" aria-label="Currency">
        {CURRENCIES.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCurrency(c.code)}
            className={cn(
              "min-w-[1.75rem] px-1 py-0.5 font-body text-[12px] font-medium transition-colors duration-200",
              currency === c.code ? "text-olive" : "text-charcoal hover:text-olive",
            )}
            aria-pressed={currency === c.code}
            aria-label={`Switch to ${c.code}`}
          >
            {c.symbol}
          </button>
        ))}
      </div>
    );
  }

  if (variant === "compact-pills") {
    return (
      <div className={cn("flex items-center gap-2", className)} role="group" aria-label="Currency">
        {CURRENCIES.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCurrency(c.code)}
            className={cn(
              "min-w-[2.25rem] px-2 py-1.5 font-body text-[12px] font-medium transition-colors duration-200",
              currency === c.code ? "bg-olive text-white" : "bg-light-grey text-charcoal hover:bg-mid-grey",
            )}
            aria-pressed={currency === c.code}
            aria-label={`Switch to ${c.code}`}
          >
            {c.symbol}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          type="button"
          onClick={() => setCurrency(c.code)}
          className={cn(
            "px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.1em] transition-all duration-150",
            currency === c.code ? "bg-olive text-white" : "text-charcoal-mid hover:text-olive",
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
