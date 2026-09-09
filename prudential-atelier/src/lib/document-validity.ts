/**
 * Invoice / quotation price validity. Distinct from invoice `dueDate`.
 * Expired invoices warn; they do not refuse payment. A human may still honour the price.
 */
export const EXPIRED_INVOICE_PAYMENT: "warn" | "refuse" = "warn";

export function expiredInvoiceBlocksPayment(): boolean {
  return EXPIRED_INVOICE_PAYMENT === "refuse";
}

export function defaultExpiresAt(from: Date, days: number): Date {
  const n = Number.isFinite(days) && days >= 0 ? Math.floor(days) : 14;
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Valid through the stated calendar day; expired the day after. Null never expires. */
export function isDocumentExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  return ymdUtc(now) > ymdUtc(expiresAt);
}

export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
