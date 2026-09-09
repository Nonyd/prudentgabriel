import { roundToKobo } from "@/lib/money";

export function clampDepositPercent(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 70;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export function depositAmountFromPercent(total: number, percent: number): number {
  const pct = clampDepositPercent(percent);
  if (pct <= 0) return 0;
  return roundToKobo(total * (pct / 100));
}

/** `90% (₦10,800,000)` — pass the already-formatted amount. */
export function formatDepositLabel(percent: number, formattedAmount: string): string {
  const pct = clampDepositPercent(percent);
  const shown = Number.isInteger(pct) ? String(pct) : String(roundToKobo(pct));
  return `${shown}% (${formattedAmount})`;
}

/**
 * Production gate: the figure on the invoice, never the CMS default.
 * A 0% invoice must stay 0 — do not fall back to 70.
 * CMS percent applies only when there is no invoice.
 */
export function depositRequiredNgnFromInvoice(params: {
  invoice: { depositRequired: number; exchangeRate: number } | null;
  orderTotalNgn: number;
  fallbackPercent: number;
}): number {
  if (params.invoice) {
    const rate = params.invoice.exchangeRate > 0 ? params.invoice.exchangeRate : 1;
    return roundToKobo(params.invoice.depositRequired * rate);
  }
  return depositAmountFromPercent(params.orderTotalNgn, params.fallbackPercent);
}

export function amountDueNow(params: {
  depositRequired: number;
  depositPaid: number;
  balanceDue: number;
}): number {
  const remainingDeposit = roundToKobo(Math.max(0, params.depositRequired - params.depositPaid));
  if (remainingDeposit > 0) return remainingDeposit;
  return roundToKobo(Math.max(0, params.balanceDue));
}
