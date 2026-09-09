import { feeShortfallWithinTolerance } from "@/lib/payments/bank-account";

/** Smallest unit we persist for naira (kobo) and for foreign money (cents). */
export function roundToKobo(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Kobo-level residue a confirmed sum may land short of a required figure.
 * One rule for the deposit gate and the balance gate. Not a fee waiver.
 * ₦1 covers FX rounding (ORD-9590 was ₦0.46 / ₦0.23 short) and a bank kobo out.
 */
export const DEPOSIT_SATISFACTION_TOLERANCE_NGN = 1;
export const LEDGER_SATISFACTION_TOLERANCE_NGN = DEPOSIT_SATISFACTION_TOLERANCE_NGN;

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

/** Remaining balance within the same ₦1 tolerance as the deposit gate. Residue stays on the ledger. */
export function balanceIsCleared(
  balanceNGN: number,
  toleranceNGN: number = LEDGER_SATISFACTION_TOLERANCE_NGN,
): boolean {
  return roundToKobo(balanceNGN) <= roundToKobo(toleranceNGN);
}

export function formatNgnKobo(amountNGN: number): string {
  const n = roundToKobo(amountNGN);
  const fraction = Math.abs(n % 1);
  return `₦${n.toLocaleString("en-NG", {
    minimumFractionDigits: fraction >= 0.005 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}
