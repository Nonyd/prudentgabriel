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

export function paystackCheckoutTotalNGN(amountNGN: number): number {
  const base = roundToKobo(amountNGN);
  return roundToKobo(base + paystackLocalFeeNGN(base));
}

export function paystackFeeCopy(amountNGN: number): {
  invoiceNGN: number;
  feeNGN: number;
  checkoutNGN: number;
  sentence: string;
} {
  const invoiceNGN = roundToKobo(amountNGN);
  const feeNGN = paystackLocalFeeNGN(invoiceNGN);
  const checkoutNGN = roundToKobo(invoiceNGN + feeNGN);
  const sentence =
    feeNGN > 0
      ? `This invoice is ${formatNaira(invoiceNGN)}. Card checkout at Paystack may show ${formatNaira(checkoutNGN)} — ${formatNaira(feeNGN)} is Paystack's processing fee (1.5% + ₦100, capped at ₦2,000). We do not add a house fee. The ledger records the invoice amount.`
      : `This invoice is ${formatNaira(invoiceNGN)}.`;
  return { invoiceNGN, feeNGN, checkoutNGN, sentence };
}

function formatNaira(n: number): string {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
