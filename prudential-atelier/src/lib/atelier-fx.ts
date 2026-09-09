import {
  convertAtLockedRate,
  lockedFxFromOrder,
  persistableFxFields,
  ratesFromLockedFx,
  roundMoney,
  type LockedFx,
} from "@/lib/fx";
import { convertToNGN, type ShopCurrency } from "@/lib/currency";
import { depositIsSatisfied, roundToKobo } from "@/lib/money";
import { asInvoiceCurrency, formatInvoiceCurrency } from "@/lib/invoice";
import type { InvoiceCurrency } from "@/types/invoice";

export type AtelierFxRow = {
  fxRateLocked?: number | null;
  fxGbpRateLocked?: number | null;
  fxRateSource?: string | null;
  fxRateFetchedAt?: Date | string | null;
  fxRateStale?: boolean | null;
};

/** Reuses Slice L's lockedFxFromOrder shape — do not invent a second FX path. */
export function lockedFxFromAtelier(row: AtelierFxRow): LockedFx {
  const fetchedAt =
    row.fxRateFetchedAt == null
      ? null
      : row.fxRateFetchedAt instanceof Date
        ? row.fxRateFetchedAt
        : new Date(row.fxRateFetchedAt);
  return lockedFxFromOrder({
    fxRateLocked: row.fxRateLocked,
    fxGbpRateLocked: row.fxGbpRateLocked,
    fxRateSource: row.fxRateSource,
    fxRateFetchedAt: fetchedAt && !Number.isNaN(fetchedAt.getTime()) ? fetchedAt : null,
    fxRateStale: row.fxRateStale,
  });
}

export { persistableFxFields };

/** NGN per 1 unit of document currency — stored on Invoice.exchangeRate. */
export function invoiceExchangeRateFromLocked(currency: string, fx: LockedFx): number {
  if (currency === "USD" && fx.rate > 0) return 1 / fx.rate;
  if (currency === "GBP" && fx.gbpRate > 0) return 1 / fx.gbpRate;
  return 1;
}

export function documentAmountToNGN(amount: number, currency: string, fx: LockedFx): number {
  if (currency === "NGN" || currency === "EUR" || !currency) return roundToKobo(amount);
  if (currency === "USD" || currency === "GBP") {
    return convertToNGN(amount, currency, ratesFromLockedFx(fx));
  }
  return roundToKobo(amount);
}

export function ngnToDocument(amountNGN: number, currency: string, fx: LockedFx): number {
  if (currency === "NGN" || currency === "EUR" || !currency) return roundToKobo(amountNGN);
  if (currency === "USD" || currency === "GBP") {
    return roundMoney(convertAtLockedRate(amountNGN, currency, fx));
  }
  return roundToKobo(amountNGN);
}

export function lockedDocumentTotal(currency: string, documentTotal: number): {
  fxUsdAmountLocked: number | null;
  fxGbpAmountLocked: number | null;
} {
  return {
    fxUsdAmountLocked: currency === "USD" ? documentTotal : null,
    fxGbpAmountLocked: currency === "GBP" ? documentTotal : null,
  };
}

/**
 * Gateway charge in the customer's chosen ShopCurrency, from an NGN ledger amount.
 * Prefers the locked document total scaled by outstanding/total (Slice L).
 */
export function atelierChargeAmountForeign(params: {
  amountNGN: number;
  totalNGN: number;
  currency: ShopCurrency;
  fx: LockedFx;
  fxUsdAmountLocked?: number | null;
  fxGbpAmountLocked?: number | null;
}): number {
  if (params.currency === "NGN") return params.amountNGN;
  const locked = params.currency === "USD" ? params.fxUsdAmountLocked : params.fxGbpAmountLocked;
  if (locked != null && locked > 0 && params.totalNGN > 0.01) {
    const scale = params.amountNGN / params.totalNGN;
    return roundMoney(locked * scale);
  }
  return roundMoney(convertAtLockedRate(params.amountNGN, params.currency, params.fx));
}

export function remainingDepositNGN(params: {
  depositRequiredNGN: number;
  confirmedNGN: number;
}): number {
  if (depositIsSatisfied(params.confirmedNGN, params.depositRequiredNGN)) return 0;
  return Math.max(0, roundToKobo(params.depositRequiredNGN - params.confirmedNGN));
}

export function formatBespokeBook(
  amountNGN: number,
  order: AtelierFxRow & { currency?: string | null },
): string {
  const currency = asInvoiceCurrency(order.currency ?? "NGN");
  const fx = lockedFxFromAtelier(order);
  const display = ngnToDocument(amountNGN, currency, fx);
  return formatInvoiceCurrency(display, currency);
}

export function asShopPayCurrency(currency: string): ShopCurrency {
  if (currency === "USD" || currency === "GBP") return currency;
  return "NGN";
}

export type { InvoiceCurrency };
