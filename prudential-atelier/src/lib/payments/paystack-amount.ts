import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { convertFromNGN, getExchangeRates, type ShopCurrency } from "@/lib/currency";
import { lockedFxFromOrder } from "@/lib/fx";
import { expectedAmountInPspUnits } from "@/lib/payment-bind";
import type { PaymentCurrency } from "@/lib/payments/index";
import { rtwChargeAmountForeign, rtwChargeAmountNGN } from "@/lib/payments/rtw-totals";

export function asPaystackCurrency(currency: string | null | undefined): PaymentCurrency {
  const u = (currency ?? "NGN").trim().toUpperCase();
  if (u === "USD" || u === "GBP") return u;
  return "NGN";
}

export function paystackSubunits(major: number): number {
  return Math.round(major * 100);
}

type RtwChargeOrder = {
  paymentStatus: PaymentStatus;
  total: number;
  balance?: number | null;
  amountPaid?: number | null;
  pointsDiscountNGN?: number | null;
  currency?: string | null;
  fxRateLocked?: number | null;
  fxGbpRateLocked?: number | null;
  fxRateSource?: string | null;
  fxRateFetchedAt?: Date | null;
  fxRateStale?: boolean | null;
  fxUsdAmountLocked?: number | null;
  fxGbpAmountLocked?: number | null;
};

export function paystackRtwMajor(order: RtwChargeOrder, currency: PaymentCurrency): number {
  if (currency === "NGN") return rtwChargeAmountNGN(order);
  return rtwChargeAmountForeign(order, currency, lockedFxFromOrder(order));
}

export function expectedPaystackRtwBind(order: RtwChargeOrder): { amount: number; currency: string } {
  const currency = asPaystackCurrency(order.currency);
  return {
    amount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, paystackRtwMajor(order, currency)),
    currency,
  };
}

export async function consultationPaystackMajor(
  feeNGN: number,
  currency: PaymentCurrency,
): Promise<number> {
  if (currency === "NGN") return feeNGN;
  const rates = await getExchangeRates();
  return Math.round(convertFromNGN(feeNGN, currency as ShopCurrency, rates) * 100) / 100;
}

export async function expectedPaystackConsultationBind(params: {
  feeNGN: number;
  currency: string | null | undefined;
}): Promise<{ amount: number; currency: string }> {
  const currency = asPaystackCurrency(params.currency);
  const major = await consultationPaystackMajor(params.feeNGN, currency);
  return {
    amount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, major),
    currency,
  };
}
