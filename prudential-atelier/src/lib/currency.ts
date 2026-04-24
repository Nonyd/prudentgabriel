import { Currency } from "@prisma/client";

export type ShopCurrency = "NGN" | "USD" | "GBP";

export interface ExchangeRatesNGN {
  NGN: number;
  USD: number;
  GBP: number;
}

const FALLBACK: ExchangeRatesNGN = { NGN: 1580, USD: 1, GBP: 0.79 };
const TTL_MS = 60 * 60 * 1000;

let moduleCache: { rates: ExchangeRatesNGN; fetchedAt: number } | null = null;

async function fetchOpenExchangeRates(): Promise<ExchangeRatesNGN> {
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!appId) return FALLBACK;

  try {
    const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=NGN,GBP`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return FALLBACK;
    const data = (await res.json()) as { rates?: { NGN?: number; GBP?: number } };
    const ngn = data.rates?.NGN;
    const gbp = data.rates?.GBP;
    if (typeof ngn !== "number" || ngn <= 0) return FALLBACK;
    return {
      NGN: ngn,
      USD: 1,
      GBP: typeof gbp === "number" && gbp > 0 ? gbp : FALLBACK.GBP,
    };
  } catch {
    return FALLBACK;
  }
}

/** Shared module cache (1 hour). Safe for server + route handlers. */
export async function getExchangeRates(): Promise<ExchangeRatesNGN> {
  const now = Date.now();
  if (moduleCache && now - moduleCache.fetchedAt < TTL_MS) {
    return moduleCache.rates;
  }
  const rates = await fetchOpenExchangeRates();
  moduleCache = { rates, fetchedAt: now };
  return rates;
}

export function convertFromNGN(amountNGN: number, toCurrency: ShopCurrency, rates: ExchangeRatesNGN): number {
  if (toCurrency === "NGN") return amountNGN;
  const usd = amountNGN / rates.NGN;
  if (toCurrency === "USD") return usd;
  return usd * rates.GBP;
}

export function convertToNGN(amount: number, from: ShopCurrency, rates: ExchangeRatesNGN): number {
  if (from === "NGN") return amount;
  if (from === "USD") return amount * rates.NGN;
  const usd = amount / rates.GBP;
  return usd * rates.NGN;
}

/** @deprecated Use getExchangeRates + convertToNGN for new code — returns per-NGN rates (USD/GBP per ₦1). */
export async function fetchExchangeRates(): Promise<Partial<Record<Currency, number>>> {
  const r = await getExchangeRates();
  return {
    NGN: 1,
    USD: 1 / r.NGN,
    GBP: r.GBP / r.NGN,
  };
}

/** @deprecated Prefer convertFromNGN / convertToNGN */
export function convertPrice(amount: number, from: Currency, to: Currency, rates: Partial<Record<Currency, number>>): number {
  const rateOr = (c: Currency, fallback: number) => {
    const v = rates[c];
    return typeof v === "number" && v > 0 ? v : fallback;
  };
  const toNgn = (value: number, c: Currency) => {
    if (c === Currency.NGN) return value;
    if (c === Currency.USD) return value / rateOr(Currency.USD, 1 / 1580);
    return value / rateOr(Currency.GBP, 0.79 / 1580);
  };
  const fromNgn = (ngn: number, c: Currency) => {
    if (c === Currency.NGN) return ngn;
    if (c === Currency.USD) return ngn * rateOr(Currency.USD, 1 / 1580);
    return ngn * rateOr(Currency.GBP, 0.79 / 1580);
  };
  const ngn = toNgn(amount, from);
  const out = fromNgn(ngn, to);
  return Number.isFinite(out) ? out : amount;
}

export function formatPrice(amount: number, currency: ShopCurrency): string {
  const rounded = Math.round(amount * 100) / 100;
  if (currency === "NGN") {
    const formatted = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rounded);
    return formatted.replace(/\bNGN\b/g, "₦").replace(/NGN\s?/, "₦");
  }
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rounded);
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}
