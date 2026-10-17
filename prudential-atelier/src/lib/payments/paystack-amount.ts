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

/**
 * A dollar or pound order may be charged in naira while Paystack cannot take that
 * currency (see paystackChargeCurrency). A naira charge then binds to the order's
 * naira amount; any other currency must be the order's own.
 */
function boundCurrency(orderCurrency: PaymentCurrency, chargedCurrency?: string | null): PaymentCurrency {
  return chargedCurrency?.trim().toUpperCase() === "NGN" ? "NGN" : orderCurrency;
}

export function expectedPaystackRtwBind(
  order: RtwChargeOrder,
  chargedCurrency?: string | null,
): { amount: number; currency: string } {
  const currency = boundCurrency(asPaystackCurrency(order.currency), chargedCurrency);
  return {
    amount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, paystackRtwMajor(order, currency)),
    currency,
  };
}

/**
 * Slice A bind for a consultation: the booking's currency and its charge (locked for BA3 USD/GBP),
 * or its naira fee when Paystack charged a dollar or pound booking in naira.
 */
export async function expectedPaystackConsultationBind(
  booking: Parameters<typeof consultationCharge>[0],
  chargedCurrency?: string | null,
): Promise<{ amount: number; currency: string }> {
  const { major, currency } = await paystackConsultationCharge(booking, chargedCurrency);
  return {
    amount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, major),
    currency,
  };
}

/** What Paystack charges for a booking: its own charge, or its naira fee when charging in naira. */
export async function paystackConsultationCharge(
  booking: Parameters<typeof consultationCharge>[0],
  chargeCurrency?: string | null,
): Promise<{ major: number; currency: PaymentCurrency }> {
  if (chargeCurrency?.trim().toUpperCase() === "NGN") return { major: booking.feeNGN, currency: "NGN" };
  return consultationCharge(booking);
}
