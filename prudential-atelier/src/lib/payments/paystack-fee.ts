import { roundToKobo } from "@/lib/money";

/** Paystack Nigeria local cards: 1.5% + ₦100, capped at ₦2,000. */
export const PAYSTACK_LOCAL_PERCENT = 0.015;
export const PAYSTACK_LOCAL_FLAT_NGN = 100;
export const PAYSTACK_LOCAL_FEE_CAP_NGN = 2_000;

/**
 * Fee Paystack adds on the checkout screen when the dashboard passes
 * transaction fees to the customer. We do not add this to the ledger amount.
 * The quoted invoice is the house price; this is the processor's take.
 */
export function paystackLocalFeeNGN(amountNGN: number): number {
  const base = roundToKobo(amountNGN);
  if (base <= 0) return 0;
  const raw = base * PAYSTACK_LOCAL_PERCENT + PAYSTACK_LOCAL_FLAT_NGN;
  return roundToKobo(Math.min(PAYSTACK_LOCAL_FEE_CAP_NGN, raw));
}

/** Paystack, cards issued outside Nigeria: 3.9% + ₦100, no cap. */
export const PAYSTACK_INTL_PERCENT = 0.039;
export const PAYSTACK_INTL_FLAT_NGN = 100;

/**
 * What Paystack asks a foreign-issued card to pay when fees are passed to the
 * customer. Paystack grosses the amount up so the house still receives the
 * invoice in full: (amount + ₦100) / (1 − 3.9%). PA-26-65822: ₦480,000 → ₦499,583.77.
 */
export function paystackIntlCheckoutTotalNGN(amountNGN: number): number {
  const base = roundToKobo(amountNGN);
  if (base <= 0) return 0;
  return roundToKobo((base + PAYSTACK_INTL_FLAT_NGN) / (1 - PAYSTACK_INTL_PERCENT));
}

export function paystackCheckoutTotalNGN(amountNGN: number): number {
  const base = roundToKobo(amountNGN);
  return roundToKobo(base + paystackLocalFeeNGN(base));
}

export function paystackFeeCopy(amountNGN: number): {
  invoiceNGN: number;
  feeNGN: number;
  checkoutNGN: number;
  intlCheckoutNGN: number;
  intlFeeNGN: number;
  sentence: string;
} {
  const invoiceNGN = roundToKobo(amountNGN);
  const feeNGN = paystackLocalFeeNGN(invoiceNGN);
  const checkoutNGN = roundToKobo(invoiceNGN + feeNGN);
  const intlCheckoutNGN = paystackIntlCheckoutTotalNGN(invoiceNGN);
  const intlFeeNGN = roundToKobo(intlCheckoutNGN - invoiceNGN);
  const sentence =
    feeNGN > 0
      ? `Your order is ${formatNaira(invoiceNGN)}. Paystack adds its card fee on the next screen. With a Nigerian card, you pay ${formatNaira(checkoutNGN)} (a fee of ${formatNaira(feeNGN)}: 1.5% + ₦100, never more than ₦2,000). With a card from outside Nigeria, the fee is higher: you pay ${formatNaira(intlCheckoutNGN)} (a fee of ${formatNaira(intlFeeNGN)}, about 4%). We do not add a fee of our own.`
      : `Your order is ${formatNaira(invoiceNGN)}.`;
  return { invoiceNGN, feeNGN, checkoutNGN, intlCheckoutNGN, intlFeeNGN, sentence };
}

function formatNaira(n: number): string {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
