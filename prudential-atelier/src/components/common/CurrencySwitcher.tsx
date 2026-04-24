"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrencyStore } from "@/store/currencyStore";

const CURRENCIES = [
  { code: "NGN" as const, symbol: "₦" },
  { code: "USD" as const, symbol: "$" },
  { code: "GBP" as const, symbol: "£" },
];

type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function CurrencySwitcher({
  className,
  variant = "default",
}: {
  className?: string;
  /** Navbar: symbol-only strip */
  variant?: "default" | "compact" | "compact-pills" | "dropdown";
}) {
  const { currency, setCurrency } = useCurrencyStore();

  if (variant === "dropdown") {
    const current = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
    return (
      <SelectPrimitive.Root
        value={currency}
        onValueChange={(v) => setCurrency(v as CurrencyCode)}
      >
        <SelectPrimitive.Trigger
          aria-label="Currency"
          className={cn(
            "flex h-8 min-w-[2.75rem] shrink-0 items-center justify-center gap-0.5 rounded-sm border border-transparent px-1.5 font-body text-[12px] font-medium text-charcoal outline-none transition-colors hover:text-olive focus-visible:border-mid-grey data-[state=open]:text-olive",
            className,
          )}
        >
          <span>{current.symbol}</span>
          <SelectPrimitive.Icon>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2} aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="z-[100] min-w-[5.5rem] overflow-hidden rounded-sm border border-mid-grey bg-[var(--white)] shadow-md"
          >
            <SelectPrimitive.Viewport className="p-1">
              {CURRENCIES.map((c) => (
                <SelectPrimitive.Item
                  key={c.code}
                  value={c.code}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center py-2 pl-7 pr-3 font-body text-[12px] text-charcoal outline-none data-[highlighted]:bg-light-grey data-[state=checked]:text-olive",
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>
                    {c.symbol} {c.code}
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  }

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
