import { Currency } from "@prisma/client";
import { roundToKobo } from "@/lib/money";

export type ShopCurrency = "NGN" | "USD" | "GBP";

/** Per-NGN rates: 1 NGN = rates.USD USD, 1 NGN = rates.GBP GBP (NGN is always 1). */
export interface ExchangeRatesNGN {
  NGN: number;
  USD: number;
  GBP: number;
}

const FALLBACK: ExchangeRatesNGN = { NGN: 1, USD: 0.00065, GBP: 0.00052 };
const TTL_MS = 60 * 60 * 1000;

/** Where a rate came from: the live feed, the manual rates on Payments, or the built-in fallback. */
export type RateSource = "openexchangerates" | "manual_rate" | "hardcoded_fallback";

export type ResolvedRates = { rates: ExchangeRatesNGN; source: RateSource; fetchedAt: Date };

/** Payments setting: "true" uses Open Exchange Rates first, the manual rates only if it fails. */
export const FX_USE_LIVE_SETTING = "fx_use_live_rates";

let moduleCache: { resolved: ResolvedRates; fetchedAt: number } | null = null;

/** Called when the rate settings change, so the next request uses them at once. */
export function clearExchangeRateCache(): void {
  moduleCache = null;
}

async function liveRatesWanted(): Promise<boolean> {
  if (typeof window !== "undefined") return false;
  const { getSetting } = await import("@/lib/settings");
  return (await getSetting(FX_USE_LIVE_SETTING))?.trim().toLowerCase() === "true";
}

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

/**
 * One answer per hour for every visitor and checkout, so the live feed is asked
 * at most ~24 times a day (Open Exchange Rates' free plan allows 1,000 a month).
 * Live mode: the feed, then the manual rates, then the fallback.
 * Manual mode: the manual rates, then the feed if they are blank, then the fallback.
 */
export async function resolveExchangeRates(): Promise<ResolvedRates> {
  const now = Date.now();
  if (moduleCache && now - moduleCache.fetchedAt < TTL_MS) {
    return moduleCache.resolved;
  }

  const live = await liveRatesWanted();
  const order: Array<() => Promise<ExchangeRatesNGN | null>> = live
    ? [fetchOpenExchangeRates, getSiteSettingRates]
    : [getSiteSettingRates, fetchOpenExchangeRates];
  const sources: RateSource[] = live ? ["openexchangerates", "manual_rate"] : ["manual_rate", "openexchangerates"];

  let resolved: ResolvedRates = { rates: FALLBACK, source: "hardcoded_fallback", fetchedAt: new Date(now) };
  for (let i = 0; i < order.length; i++) {
    const rates = await order[i]!();
    if (rates) {
      resolved = { rates, source: sources[i]!, fetchedAt: new Date(now) };
      break;
    }
  }
  moduleCache = { resolved, fetchedAt: now };
  return resolved;
}

export async function getExchangeRates(): Promise<ExchangeRatesNGN> {
  return (await resolveExchangeRates()).rates;
}

export function convertFromNGN(amountNGN: number, toCurrency: ShopCurrency, rates: ExchangeRatesNGN): number {
  if (toCurrency === "NGN") return amountNGN;
  if (toCurrency === "USD") return amountNGN * rates.USD;
  return amountNGN * rates.GBP;
}

export function convertToNGN(amount: number, from: ShopCurrency, rates: ExchangeRatesNGN): number {
  if (from === "NGN") return roundToKobo(amount);
  if (from === "USD") return roundToKobo(amount / rates.USD);
  return roundToKobo(amount / rates.GBP);
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
