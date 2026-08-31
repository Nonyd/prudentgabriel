/** Shared admin order-list filters (page + CSV API). */
import { OrderStatus, PaymentStatus, type Prisma } from "@prisma/client";

export const REFUND_REQUIRED_ATTENTION = "refund-required";
/** Quote-pending orders that have reached PROCESSING — ready to contact after packing. */
export const QUOTE_PENDING_ATTENTION = "quote-pending";
/** Every quote-pending order, including those not yet packed. */
export const QUOTE_PENDING_ALL_ATTENTION = "quote-pending-all";

export function isRefundRequiredOrder(row: {
  paymentStatus: PaymentStatus | string;
  status: OrderStatus | string;
}): boolean {
  return row.paymentStatus === PaymentStatus.PAID && row.status === OrderStatus.CANCELLED;
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
  return where;
}
