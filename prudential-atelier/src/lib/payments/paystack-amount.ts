import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { lockedFxFromOrder } from "@/lib/fx";
import { expectedAmountInPspUnits } from "@/lib/payment-bind";
import type { PaymentCurrency } from "@/lib/payments/index";
import { rtwChargeAmountForeign, rtwChargeAmountNGN } from "@/lib/payments/rtw-totals";
import { consultationCharge } from "@/lib/consultation-fees";

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

/** Slice A bind for a consultation: the booking's currency and its charge (locked for BA3 USD/GBP). */
export async function expectedPaystackConsultationBind(
  booking: Parameters<typeof consultationCharge>[0],
): Promise<{ amount: number; currency: string }> {
  const { major, currency } = await consultationCharge(booking);
  return {
    amount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, major),
    currency,
  };
}
