import { OrderStatus, PaymentMethod, PaymentStatus, ShippingQuoteStatus, type Order } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { convertAtLockedRate, lockedFxFromOrder } from "@/lib/fx";
import { rtwChargeAmountNGN } from "@/lib/payments/rtw-totals";
import { shippingPayPath } from "@/lib/shipping/pay-link";

/** An order whose shipping is quoted can no longer be paid once it is closed. */
const CLOSED: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.ABANDONED];

type DueOrder = Pick<
  Order,
  | "id"
  | "status"
  | "paymentStatus"
  | "shippingQuoteStatus"
  | "total"
  | "balance"
  | "amountPaid"
  | "pointsDiscountNGN"
  | "shippingAmount"
  | "currency"
  | "fxRateLocked"
  | "fxGbpRateLocked"
  | "fxRateSource"
  | "fxRateFetchedAt"
  | "fxRateStale"
>;

/** Naira still to pay on a quoted order: the shipping, plus the piece if she has not paid for it yet. */
export function shippingAmountDueNGN(order: DueOrder): number {
  if (order.shippingQuoteStatus !== ShippingQuoteStatus.QUOTED) return 0;
  if (CLOSED.includes(order.status)) return 0;
  if (order.paymentStatus === PaymentStatus.REFUNDED) return 0;
  const due = rtwChargeAmountNGN(order);
  if (order.paymentStatus === PaymentStatus.PAID && (order.balance ?? 0) <= 0.01) return 0;
  return due > 0.01 ? due : 0;
}

export function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

/** "₦151,000", or "₦151,000 (about $98.40)" for a dollar or pound order. */
export function shippingDueLabel(order: DueOrder, amountNGN: number): string {
  const naira = formatNaira(amountNGN);
  const cur = String(order.currency);
  if (cur !== "USD" && cur !== "GBP") return naira;
  const foreign = convertAtLockedRate(amountNGN, cur, lockedFxFromOrder(order));
  if (!Number.isFinite(foreign) || foreign <= 0) return naira;
  const sym = cur === "USD" ? "$" : "£";
  return `${naira} (about ${sym}${foreign.toFixed(2)})`;
}

export type ShippingDueItem = {
  orderId: string;
  orderNumber: string;
  amountNGN: number;
  amountLabel: string;
  /** True when the piece itself is not paid yet, so the amount is more than shipping. */
  includesPiece: boolean;
  carrier: string | null;
  payPath: string;
  /** She uploaded a transfer receipt and it is waiting for the house to confirm. */
  underReview: boolean;
};

/** A bank-transfer receipt she sent for this order that the house has not approved or rejected yet. */
export async function findPendingShippingReceipt(orderId: string) {
  return prisma.payment.findFirst({
    where: { orderId, status: PaymentStatus.PENDING, method: PaymentMethod.BANK_TRANSFER },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, receiptUrl: true, createdAt: true, reference: true },
  });
}

/** Her latest transfer receipt for this order, when the house rejected it (to show her why). */
export async function findRejectedShippingReceipt(orderId: string) {
  const last = await prisma.payment.findFirst({
    where: { orderId, method: PaymentMethod.BANK_TRANSFER },
    orderBy: { createdAt: "desc" },
    select: { status: true, rejectedReason: true },
  });
  return last && last.status === PaymentStatus.REJECTED ? last : null;
}

/** Every order of hers with shipping quoted and not yet paid. */
export async function loadShippingDue(userId: string): Promise<ShippingDueItem[]> {
  const orders = await prisma.order.findMany({
    where: {
      userId,
      shippingQuoteStatus: ShippingQuoteStatus.QUOTED,
      status: { notIn: CLOSED },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  const pending = await prisma.payment.findMany({
    where: {
      orderId: { in: orders.map((o) => o.id) },
      status: PaymentStatus.PENDING,
      method: PaymentMethod.BANK_TRANSFER,
    },
    select: { orderId: true },
  });
  const reviewing = new Set(pending.map((p) => p.orderId));
  const out: ShippingDueItem[] = [];
  for (const o of orders) {
    const amountNGN = shippingAmountDueNGN(o);
    if (amountNGN <= 0) continue;
    out.push({
      orderId: o.id,
      orderNumber: o.orderNumber,
      amountNGN,
      amountLabel: shippingDueLabel(o, amountNGN),
      includesPiece: o.paymentStatus !== PaymentStatus.PAID,
      carrier: o.carrier,
      payPath: shippingPayPath(o.id),
      underReview: reviewing.has(o.id),
    });
  }
  return out;
}
