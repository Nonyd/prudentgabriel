/** Shared admin order-list filters (page + CSV API). */
import { OrderStatus, PaymentGateway, PaymentStatus, type Prisma } from "@prisma/client";
import { FABRIC_UNAVAILABLE_ATTENTION, fabricQueueWhere } from "@/lib/fabric-unavailable";

export const REFUND_REQUIRED_ATTENTION = "refund-required";
/** Quote-pending orders that have reached PROCESSING — ready to contact after packing. */
export const QUOTE_PENDING_ATTENTION = "quote-pending";
/** Every quote-pending order, including those not yet packed. */
export const QUOTE_PENDING_ALL_ATTENTION = "quote-pending-all";
/** Guest custom (made-to-order) — call before cutting. */
export const GUEST_CUSTOM_ATTENTION = "guest-custom";
/** Bank transfer uploaded, waiting for admin to approve the receipt. */
export const BANK_TRANSFER_PENDING_ATTENTION = "bank-transfer-pending";
/**
 * Unpaid checkout attempts: live PENDING holds and expired ABANDONED rows.
 * Bank-transfer PENDING stays on the main list (needs proof review).
 */
export const ABANDONED_ATTEMPTS_ATTENTION = "abandoned-attempts";
export { FABRIC_UNAVAILABLE_ATTENTION };

export function isRefundRequiredOrder(row: {
  paymentStatus: PaymentStatus | string;
  status: OrderStatus | string;
}): boolean {
  return row.paymentStatus === PaymentStatus.PAID && row.status === OrderStatus.CANCELLED;
}

/** Unpaid checkout attempt that should not clutter the default orders list. */
export function isAbandonedCheckoutAttempt(row: {
  status: OrderStatus | string;
  paymentStatus: PaymentStatus | string;
  paymentGateway?: PaymentGateway | string | null;
}): boolean {
  if (row.status === OrderStatus.ABANDONED || row.status === "ABANDONED") return true;
  if (row.status !== OrderStatus.PENDING && row.status !== "PENDING") return false;
  if (row.paymentStatus === PaymentStatus.PAID || row.paymentStatus === "PAID") return false;
  if (row.paymentStatus === PaymentStatus.REFUNDED || row.paymentStatus === "REFUNDED") return false;
  if (
    (row.paymentGateway === PaymentGateway.BANK_TRANSFER || row.paymentGateway === "BANK_TRANSFER") &&
    (row.paymentStatus === PaymentStatus.PENDING || row.paymentStatus === "PENDING")
  ) {
    return false;
  }
  return (
    row.paymentStatus === PaymentStatus.PENDING ||
    row.paymentStatus === "PENDING" ||
    row.paymentStatus === PaymentStatus.FAILED ||
    row.paymentStatus === "FAILED"
  );
}

/** Prisma clause matching {@link isAbandonedCheckoutAttempt}. */
export function abandonedCheckoutAttemptWhere(): Prisma.OrderWhereInput {
  return {
    OR: [
      { status: OrderStatus.ABANDONED },
      {
        status: OrderStatus.PENDING,
        paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
        NOT: {
          paymentGateway: PaymentGateway.BANK_TRANSFER,
          paymentStatus: PaymentStatus.PENDING,
        },
      },
    ],
  };
}

/** Default list: real orders — paid and beyond, plus bank proof waiting. */
export function excludeAbandonedCheckoutAttempts(
  where: Prisma.OrderWhereInput,
): Prisma.OrderWhereInput {
  const exclude = { NOT: abandonedCheckoutAttemptWhere() };
  if (!where || Object.keys(where).length === 0) return exclude;
  return { AND: [where, exclude] };
}

export function applyOrderAttention(
  where: Prisma.OrderWhereInput,
  attention: string | null | undefined,
): Prisma.OrderWhereInput {
  if (attention === REFUND_REQUIRED_ATTENTION) {
    return {
      ...where,
      status: OrderStatus.CANCELLED,
      paymentStatus: PaymentStatus.PAID,
      refundRecordedAt: null,
    };
  }
  if (attention === QUOTE_PENDING_ATTENTION) {
    return {
      ...where,
      shippingQuoteStatus: "QUOTE_PENDING",
      status: OrderStatus.PROCESSING,
    };
  }
  if (attention === QUOTE_PENDING_ALL_ATTENTION) {
    return {
      ...where,
      shippingQuoteStatus: "QUOTE_PENDING",
    };
  }
  if (attention === GUEST_CUSTOM_ATTENTION) {
    return {
      ...where,
      guestCustom: true,
    };
  }
  if (attention === BANK_TRANSFER_PENDING_ATTENTION) {
    return {
      ...where,
      paymentGateway: PaymentGateway.BANK_TRANSFER,
      paymentStatus: PaymentStatus.PENDING,
    };
  }
  if (attention === ABANDONED_ATTEMPTS_ATTENTION) {
    return {
      AND: [where, abandonedCheckoutAttemptWhere()],
    };
  }
  if (attention === FABRIC_UNAVAILABLE_ATTENTION) {
    return {
      ...where,
      ...fabricQueueWhere(),
    };
  }
  return where;
}

/**
 * Apply attention filters, then (unless viewing abandoned attempts or an explicit status/payment
 * filter) hide unpaid checkout clutter from the default list.
 */
export function applyAdminOrdersListWhere(
  where: Prisma.OrderWhereInput,
  attention: string | null | undefined,
  opts?: { explicitStatus?: boolean; explicitPayment?: boolean },
): Prisma.OrderWhereInput {
  const attended = applyOrderAttention(where, attention);
  if (attention === ABANDONED_ATTEMPTS_ATTENTION) return attended;
  if (attention) return attended;
  if (opts?.explicitStatus || opts?.explicitPayment) {
    if (opts.explicitStatus) return attended;
    return { AND: [attended, { status: { not: OrderStatus.ABANDONED } }] };
  }
  return excludeAbandonedCheckoutAttempts(attended);
}
