"use client";

import { useEffect } from "react";
import { useCurrencyStore } from "@/store/currencyStore";

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const setRates = useCurrencyStore((s) => s.setRates);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/currency/rates")
      .then((r) => r.json())
      .then((j: { NGN?: number; USD?: number; GBP?: number }) => {
        if (cancelled) return;
        if (typeof j.NGN === "number" && j.NGN > 0) {
          setRates({
            NGN: j.NGN,
            USD: typeof j.USD === "number" ? j.USD : 1,
            GBP: typeof j.GBP === "number" ? j.GBP : 0.79,
            fetchedAt: Date.now(),
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setRates]);

  return <>{children}</>;
}
