import { Currency } from "@prisma/client";

export type ShopCurrency = "NGN" | "USD" | "GBP";

/** Per-NGN rates: 1 NGN = rates.USD USD, 1 NGN = rates.GBP GBP (NGN is always 1). */
export interface ExchangeRatesNGN {
  NGN: number;
  USD: number;
  GBP: number;
}

const FALLBACK: ExchangeRatesNGN = { NGN: 1, USD: 0.00065, GBP: 0.00052 };
const TTL_MS = 60 * 60 * 1000;

let moduleCache: { rates: ExchangeRatesNGN; fetchedAt: number } | null = null;

async function getSiteSettingRates(): Promise<ExchangeRatesNGN | null> {
  if (typeof window !== "undefined") return null;
  const { getSetting } = await import("@/lib/settings");
  const [usdRaw, gbpRaw] = await Promise.all([
    getSetting("exchange_rate_usd"),
    getSetting("exchange_rate_gbp"),
  ]);
  const usd = usdRaw ? Number.parseFloat(usdRaw) : NaN;
  const gbp = gbpRaw ? Number.parseFloat(gbpRaw) : NaN;
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(gbp) || gbp <= 0) {
    return null;
  }
  return { NGN: 1, USD: usd, GBP: gbp };
}

async function fetchOpenExchangeRates(): Promise<ExchangeRatesNGN | null> {
  const { getDashboardSecret } = await import("@/lib/credential-catalog");
  const appId = await getDashboardSecret("open_exchange_rates_app_id");
  if (!appId) return null;

  try {
    const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=NGN,GBP`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: { NGN?: number; GBP?: number } };
    const ngnPerUsd = data.rates?.NGN;
    const gbpPerUsd = data.rates?.GBP;
    if (typeof ngnPerUsd !== "number" || ngnPerUsd <= 0) return null;
    const usdPerNgn = 1 / ngnPerUsd;
    const gbpPerNgn =
      typeof gbpPerUsd === "number" && gbpPerUsd > 0 ? gbpPerUsd / ngnPerUsd : FALLBACK.GBP;
    return { NGN: 1, USD: usdPerNgn, GBP: gbpPerNgn };
  } catch {
    return null;
  }
}

/** Shared module cache (1 hour). Reads SiteSetting first, then Open Exchange Rates, then fallback. */
export async function getExchangeRates(): Promise<ExchangeRatesNGN> {
  const now = Date.now();
  if (moduleCache && now - moduleCache.fetchedAt < TTL_MS) {
    return moduleCache.rates;
  }

  const fromSettings = await getSiteSettingRates();
  const rates = fromSettings ?? (await fetchOpenExchangeRates()) ?? FALLBACK;
  moduleCache = { rates, fetchedAt: now };
  return rates;
}

export function convertFromNGN(amountNGN: number, toCurrency: ShopCurrency, rates: ExchangeRatesNGN): number {
  if (toCurrency === "NGN") return amountNGN;
  if (toCurrency === "USD") return amountNGN * rates.USD;
  return amountNGN * rates.GBP;
}

export function convertToNGN(amount: number, from: ShopCurrency, rates: ExchangeRatesNGN): number {
  if (from === "NGN") return amount;
  if (from === "USD") return amount / rates.USD;
  return amount / rates.GBP;
}

/** @deprecated Use getExchangeRates + convertToNGN for new code — returns per-NGN rates (USD/GBP per ₦1). */
export async function fetchExchangeRates(): Promise<Partial<Record<Currency, number>>> {
  const r = await getExchangeRates();
  return {
    NGN: 1,
    USD: r.USD,
    GBP: r.GBP,
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
    if (c === Currency.USD) return value / rateOr(Currency.USD, 0.00065);
    return value / rateOr(Currency.GBP, 0.00052);
  };
  const fromNgn = (ngn: number, c: Currency) => {
    if (c === Currency.NGN) return ngn;
    if (c === Currency.USD) return ngn * rateOr(Currency.USD, 0.00065);
    return ngn * rateOr(Currency.GBP, 0.00052);
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

/** Alternate-currency line on the PDP: "Also $130 or £104" — no cents on round figures. */
export function formatAlsoAmount(amount: number, currency: "USD" | "GBP"): string {
  const rounded = Math.round(amount * 100) / 100;
  const whole = Math.abs(rounded - Math.round(rounded)) < 0.005;
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(rounded);
}
