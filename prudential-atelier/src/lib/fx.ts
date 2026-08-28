import { prisma } from "@/lib/prisma";
import {
  convertFromNGN,
  getExchangeRates,
  type ExchangeRatesNGN,
  type ShopCurrency,
} from "@/lib/currency";

export type LockedFx = {
  /** USD per ₦1 */
  rate: number;
  source: string;
  fetchedAt: Date;
  stale: boolean;
  gbpRate: number;
};

let testFx: LockedFx | null = null;

export function setLockedFxForTest(fx: LockedFx | null): void {
  testFx = fx;
}

async function persistSnapshot(rates: ExchangeRatesNGN, source: string, stale: boolean): Promise<void> {
  const now = new Date();
  try {
    await prisma.exchangeRateSnapshot.upsert({
      where: { pair: "NGN_USD" },
      create: {
        pair: "NGN_USD",
        rate: rates.USD,
        source,
        fetchedAt: now,
        stale,
      },
      update: {
        rate: rates.USD,
        source,
        fetchedAt: now,
        stale,
      },
    });
  } catch (e) {
    console.warn("[fx-snapshot]", e);
  }
}

/**
 * Live NGN→USD with DB cache. Never throws — checkout must not block on FX.
 * `rate` is USD per ₦1 (same unit as SiteSetting exchange_rate_usd).
 */
export async function getLockedFx(): Promise<LockedFx> {
  if (testFx) return testFx;

  try {
    const rates = await getExchangeRates();
    const source =
      process.env.OPEN_EXCHANGE_RATES_APP_ID?.trim() ? "openexchangerates" : "site_setting_or_fallback";
    const stale = source === "site_setting_or_fallback" && !process.env.OPEN_EXCHANGE_RATES_APP_ID;
    await persistSnapshot(rates, source, stale);
    return {
      rate: rates.USD,
      source,
      fetchedAt: new Date(),
      stale,
      gbpRate: rates.GBP,
    };
  } catch {
    const cached = await prisma.exchangeRateSnapshot.findUnique({ where: { pair: "NGN_USD" } });
    if (cached) {
      await prisma.exchangeRateSnapshot.update({
        where: { pair: "NGN_USD" },
        data: { stale: true },
      });
      return {
        rate: cached.rate,
        source: cached.source,
        fetchedAt: cached.fetchedAt,
        stale: true,
        gbpRate: 0.00052,
      };
    }
    return {
      rate: 0.00065,
      source: "hardcoded_fallback",
      fetchedAt: new Date(),
      stale: true,
      gbpRate: 0.00052,
    };
  }
}

export function convertAtLockedRate(amountNGN: number, to: ShopCurrency, fx: LockedFx): number {
  if (to === "NGN") return amountNGN;
  const rates: ExchangeRatesNGN = { NGN: 1, USD: fx.rate, GBP: fx.gbpRate };
  return convertFromNGN(amountNGN, to, rates);
}

export function usdOverrideOrConvert(amountNGN: number, overrideUSD: number | null | undefined, fx: LockedFx): number {
  if (overrideUSD != null && overrideUSD > 0) return overrideUSD;
  return convertAtLockedRate(amountNGN, "USD", fx);
}
