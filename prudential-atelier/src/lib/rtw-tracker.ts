import type { OrderStatus, PaymentStatus } from "@prisma/client";

export type ShopMoneyCurrency = "NGN" | "USD" | "GBP";

export type RtwPaidDisplay = {
  amount: number;
  currency: ShopMoneyCurrency;
};

/** What she actually paid, in the currency the gateway charged. */
export function rtwPaidInChargedCurrency(order: {
  total: number;
  currency?: string | null;
  fxUsdAmountLocked?: number | null;
  fxGbpAmountLocked?: number | null;
  fxRateLocked?: number | null;
  fxGbpRateLocked?: number | null;
}): RtwPaidDisplay {
  const currency: ShopMoneyCurrency =
    order.currency === "USD" || order.currency === "GBP" ? order.currency : "NGN";
  if (currency === "USD") {
    if (order.fxUsdAmountLocked != null && Number.isFinite(order.fxUsdAmountLocked)) {
      return { amount: order.fxUsdAmountLocked, currency: "USD" };
    }
    if (order.fxRateLocked != null && order.fxRateLocked > 0) {
      return { amount: order.total * order.fxRateLocked, currency: "USD" };
    }
    return { amount: order.total, currency: "NGN" };
  }
  if (currency === "GBP") {
    if (order.fxGbpAmountLocked != null && Number.isFinite(order.fxGbpAmountLocked)) {
      return { amount: order.fxGbpAmountLocked, currency: "GBP" };
    }
    if (order.fxGbpRateLocked != null && order.fxGbpRateLocked > 0) {
      return { amount: order.total * order.fxGbpRateLocked, currency: "GBP" };
    }
    return { amount: order.total, currency: "NGN" };
  }
  return { amount: order.total, currency: "NGN" };
}

export function canViewRtwTracker(
  order: { userId: string | null; guestEmail: string | null; userEmail: string | null },
  actor: { userId?: string | null; email?: string | null },
): boolean {
  if (actor.userId && order.userId && actor.userId === order.userId) return true;
  const email = actor.email?.trim().toLowerCase();
  if (!email) return false;
  if (order.guestEmail?.toLowerCase() === email) return true;
  if (order.userEmail?.toLowerCase() === email) return true;
  return false;
}

/** Dress buyers without a commission should not land on an empty atelier list. */
export function defaultAccountOrdersTab(commissionCount: number): "bespoke" | "rtw" {
  return commissionCount > 0 ? "bespoke" : "rtw";
}

const STATUS_COPY: Record<OrderStatus, string> = {
  PENDING: "Waiting for payment",
  CONFIRMED: "Paid — we are preparing it",
  PROCESSING: "Being packed",
  CUTTING: "Being cut",
  MAKING: "Being sewn",
  SHIPPED: "On its way",
  DELIVERED: "Delivered",
  READY_FOR_COLLECTION: "Ready to collect",
  COLLECTED: "Collected",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  ARCHIVED: "Complete",
};

export function rtwTrackerStatusLabel(
  status: string,
  paymentStatus?: PaymentStatus | string | null,
): string {
  if (paymentStatus && paymentStatus !== "PAID" && status === "PENDING") {
    return "Waiting for payment";
  }
  return STATUS_COPY[status as OrderStatus] ?? status.replace(/_/g, " ").toLowerCase();
}
