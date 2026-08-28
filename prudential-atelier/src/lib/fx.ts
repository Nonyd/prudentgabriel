import { prisma } from "@/lib/prisma";
import {
  convertFromNGN,
  getExchangeRates,
  type ExchangeRatesNGN,
  type ShopCurrency,
} from "@/lib/currency";
import { overrideOrConvert } from "@/lib/pricing";

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

export function ratesFromLockedFx(fx: LockedFx): ExchangeRatesNGN {
  return { NGN: 1, USD: fx.rate, GBP: fx.gbpRate };
}

export function convertAtLockedRate(amountNGN: number, to: ShopCurrency, fx: LockedFx): number {
  if (to === "NGN") return amountNGN;
  return convertFromNGN(amountNGN, to, ratesFromLockedFx(fx));
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Shipping is always converted at the locked rate (never overridden).
 * Adding the rounded conversion keeps locked USD/GBP in cents so a later
 * top-up of the same ₦ delta charges the same figure.
 */
export function applyShippingQuoteToLocked(
  previousLocked: number | null | undefined,
  deltaNGN: number,
  currency: "USD" | "GBP",
  fx: LockedFx,
): number | null {
  if (previousLocked == null) return null;
  return Math.max(0, roundMoney(previousLocked + convertAtLockedRate(deltaNGN, currency, fx)));
}

export function lockedFxFromOrder(order: {
  fxRateLocked?: number | null;
  fxGbpRateLocked?: number | null;
  fxRateSource?: string | null;
  fxRateFetchedAt?: Date | null;
  fxRateStale?: boolean | null;
}): LockedFx {
  return {
    rate: order.fxRateLocked && order.fxRateLocked > 0 ? order.fxRateLocked : 0.00065,
    gbpRate: order.fxGbpRateLocked && order.fxGbpRateLocked > 0 ? order.fxGbpRateLocked : 0.00052,
    source: order.fxRateSource ?? "locked",
    fetchedAt: order.fxRateFetchedAt ?? new Date(),
    stale: Boolean(order.fxRateStale),
  };
}

export function usdOverrideOrConvert(amountNGN: number, overrideUSD: number | null | undefined, fx: LockedFx): number {
  return overrideOrConvert(amountNGN, "USD", overrideUSD, ratesFromLockedFx(fx));
}

export function gbpOverrideOrConvert(amountNGN: number, overrideGBP: number | null | undefined, fx: LockedFx): number {
  return overrideOrConvert(amountNGN, "GBP", overrideGBP, ratesFromLockedFx(fx));
}

export function lockForeignTotals(params: {
  itemUsd: number;
  itemGbp: number;
  extrasNGN: number;
  fx: LockedFx;
}): { fxUsdAmountLocked: number; fxGbpAmountLocked: number } {
  const extrasUsd = convertAtLockedRate(params.extrasNGN, "USD", params.fx);
  const extrasGbp = convertAtLockedRate(params.extrasNGN, "GBP", params.fx);
  return {
    fxUsdAmountLocked: Math.max(0, roundMoney(params.itemUsd + extrasUsd)),
    fxGbpAmountLocked: Math.max(0, roundMoney(params.itemGbp + extrasGbp)),
  };
}
