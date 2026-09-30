import type { Prisma } from "@prisma/client";
import { FINANCE_TZ } from "@/lib/finance/aa0";
import { lagosStart } from "@/lib/finance/period";

/**
 * Slice BC3 — "show me May's orders". A delivery month is a Lagos calendar
 * month over BespokeOrder.deliveryDate (the expected delivery date, set from the
 * quotation at convert and adjustable after). The enquiry's event date is not a
 * delivery date and is never read here.
 */

export type DeliveryMonth = { year: number; month: number };

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-05" → { year: 2026, month: 5 }. Anything else → null. */
export function parseDeliveryMonth(value: string | null | undefined): DeliveryMonth | null {
  const m = MONTH_RE.exec((value ?? "").trim());
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function formatDeliveryMonth({ year, month }: DeliveryMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function deliveryMonthLabel({ year, month }: DeliveryMonth): string {
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function nextDeliveryMonth({ year, month }: DeliveryMonth): DeliveryMonth {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** [from, to) for a Lagos calendar month. */
export function deliveryMonthRange(dm: DeliveryMonth): { gte: Date; lt: Date } {
  const next = nextDeliveryMonth(dm);
  return { gte: lagosStart(dm.year, dm.month, 1), lt: lagosStart(next.year, next.month, 1) };
}

/** The Lagos month that contains `at`. */
export function deliveryMonthOf(at: Date): DeliveryMonth {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FINANCE_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(at);
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: num("year"), month: num("month") };
}

/**
 * A delivery date from a form: "2026-05-14" → that calendar day (UTC midnight,
 * inside the same Lagos day). Empty → null (cleared). Anything else → undefined
 * (invalid; the caller answers 400).
 */
export function parseDeliveryDateInput(value: unknown): Date | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(dt.getTime()) || dt.getUTCDate() !== Number(m[3])) return undefined;
  return dt;
}

/** Prisma filter for commissions expected in a month. */
export function deliveryMonthWhere(dm: DeliveryMonth): Prisma.BespokeOrderWhereInput {
  return { deliveryDate: deliveryMonthRange(dm) };
}

/** Commissions still open: not delivered, cancelled or archived. */
export const OPEN_COMMISSION_WHERE: Prisma.BespokeOrderWhereInput = {
  status: { notIn: ["DELIVERED", "CANCELLED", "ARCHIVED"] },
};

/** This month and next, from `now` — the question behind "show me May's orders". */
export function dueWindows(now: Date): { thisMonth: DeliveryMonth; nextMonth: DeliveryMonth } {
  const thisMonth = deliveryMonthOf(now);
  return { thisMonth, nextMonth: nextDeliveryMonth(thisMonth) };
}
