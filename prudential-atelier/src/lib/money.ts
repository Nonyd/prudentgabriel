import { feeShortfallWithinTolerance } from "@/lib/payments/bank-account";

/** Smallest unit we persist for naira (kobo) and for foreign money (cents). */
export function roundToKobo(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Kobo-level residue a confirmed deposit may land short and still unlock production.
 * Mirrors Slice P's wire-fee epsilon: not a fee waiver, not a loosened gate.
 * ₦1 covers FX rounding (ORD-9590 was ₦0.46 short) and a bank kobo out.
 */
export const DEPOSIT_SATISFACTION_TOLERANCE_NGN = 1;

export function depositIsSatisfied(
  confirmedNGN: number,
  depositRequiredNGN: number,
  toleranceNGN: number = DEPOSIT_SATISFACTION_TOLERANCE_NGN,
): boolean {
  const required = roundToKobo(depositRequiredNGN);
  const confirmed = roundToKobo(confirmedNGN);
  if (required <= 0) return true;
  return feeShortfallWithinTolerance(required, confirmed, toleranceNGN);
}

export function formatNgnKobo(amountNGN: number): string {
  return `₦${roundToKobo(amountNGN).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
