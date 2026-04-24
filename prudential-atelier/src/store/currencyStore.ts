import { create } from "zustand";
import { persist } from "zustand/middleware";

type Currency = "NGN" | "USD" | "GBP";

interface ExchangeRates {
  NGN: number;
  USD: number;
  GBP: number;
  fetchedAt: number;
}

interface CurrencyStore {
  currency: Currency;
  rates: ExchangeRates;
  setCurrency: (c: Currency) => void;
  setRates: (r: ExchangeRates) => void;
}

const DEFAULT_RATES: ExchangeRates = {
  NGN: 1580,
  USD: 1,
  GBP: 0.79,
  fetchedAt: 0,
};

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set) => ({
      currency: "NGN",
      rates: DEFAULT_RATES,
      setCurrency: (currency) => set({ currency }),
      setRates: (rates) => set({ rates }),
    }),
    {
      name: "pa-currency",
    },
  ),
);
