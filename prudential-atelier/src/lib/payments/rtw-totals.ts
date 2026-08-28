import { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dec, toNumber, type PaymentSummary } from "@/lib/payments/ledger";
import { convertAtLockedRate, roundMoney, type LockedFx } from "@/lib/fx";
import type { ShopCurrency } from "@/lib/currency";

const ZERO = new Prisma.Decimal(0);

/**
 * Ledger-derived RTW totals. Writer for Order.amountPaid / Order.balance only.
 * BespokeOrder caches stay on recomputeOrderTotals — different table, no overlap.
 */
export async function getRtwPaymentSummary(orderId: string): Promise<PaymentSummary> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, total: true },
  });
  if (!order) throw new Error(`Order not found: ${orderId}`);

  const total = dec(order.total);
  const [confirmedRows, pendingRows] = await Promise.all([
    prisma.payment.findMany({
      where: { orderId, status: PaymentStatus.CONFIRMED },
      select: { amount: true },
    }),
    prisma.payment.findMany({
      where: { orderId, status: PaymentStatus.PENDING },
      select: { amount: true },
    }),
  ]);

  const confirmed = confirmedRows.reduce((acc, r) => acc.plus(r.amount), ZERO);
  const pending = pendingRows.reduce((acc, r) => acc.plus(r.amount), ZERO);
  const balance = Prisma.Decimal.max(ZERO, total.minus(confirmed));
  const isFullyPaid = confirmed.gte(total) && total.gt(ZERO);

  return {
    total,
    confirmed,
    pending,
    balance,
    depositRequired: total,
    depositSatisfied: isFullyPaid,
    isFullyPaid,
  };
}

export async function recomputeRtwOrderTotals(orderId: string): Promise<PaymentSummary> {
  const summary = await getRtwPaymentSummary(orderId);
  const balance = toNumber(summary.balance);
  await prisma.order.update({
    where: { id: orderId },
    data: {
      amountPaid: toNumber(summary.confirmed),
      balance,
      ...(summary.isFullyPaid
        ? { paymentStatus: PaymentStatus.PAID }
        : toNumber(summary.confirmed) > 0
          ? {}
          : {}),
    },
  });
  return summary;
}

export function rtwHasOutstandingBalance(order: { balance?: number | null; total: number; amountPaid?: number | null }): boolean {
  const paid = order.amountPaid ?? 0;
  const balance = order.balance ?? Math.max(0, order.total - paid);
  return balance > 0.01;
}

/**
 * First payment, or a quoted shipping fee after the garment is already paid.
 * PSP bind and initiate both use rtwChargeAmountNGN — never order.total on a top-up.
 */
export function canAcceptRtwPayment(order: {
  paymentStatus: PaymentStatus;
  balance?: number | null;
  total?: number;
  amountPaid?: number | null;
}): boolean {
  if (order.paymentStatus === PaymentStatus.PENDING || order.paymentStatus === PaymentStatus.FAILED) return true;
  if (order.paymentStatus === PaymentStatus.PAID && rtwHasOutstandingBalance(order as { balance?: number | null; total: number; amountPaid?: number | null })) {
    return true;
  }
  return false;
}

/** Amount this charge must equal: outstanding balance after a quote, else total. */
export function rtwChargeAmountNGN(order: {
  paymentStatus: PaymentStatus;
  total: number;
  balance?: number | null;
  amountPaid?: number | null;
}): number {
  if (order.paymentStatus === PaymentStatus.PAID && rtwHasOutstandingBalance(order)) {
    return order.balance ?? Math.max(0, order.total - (order.amountPaid ?? 0));
  }
  return order.total;
}

/**
 * USD/GBP to charge on this PSP attempt.
 * First payment: the amount locked at checkout (line overrides + converted extras).
 * Shipping top-up: convert the outstanding ₦ at the locked rate — shipping is never
 * overridden, and scaling locked × (outstanding/total) overcharges when the garment
 * was a $ override and the quote is converted ₦.
 */
export function rtwChargeAmountForeign(
  order: {
    paymentStatus: PaymentStatus;
    total: number;
    balance?: number | null;
    amountPaid?: number | null;
    fxUsdAmountLocked?: number | null;
    fxGbpAmountLocked?: number | null;
  },
  currency: ShopCurrency,
  fx: LockedFx,
): number {
  const ngn = rtwChargeAmountNGN(order);
  if (currency === "NGN") return ngn;
  if (order.paymentStatus === PaymentStatus.PAID && rtwHasOutstandingBalance(order)) {
    return roundMoney(convertAtLockedRate(ngn, currency, fx));
  }
  const locked = currency === "USD" ? order.fxUsdAmountLocked : order.fxGbpAmountLocked;
  if (locked != null && locked > 0) return roundMoney(locked);
  return roundMoney(convertAtLockedRate(ngn, currency, fx));
}
