/** Shared admin order-list filters (page + CSV API). */
import { OrderStatus, PaymentGateway, PaymentStatus, type Prisma } from "@prisma/client";

export const REFUND_REQUIRED_ATTENTION = "refund-required";
/** Quote-pending orders that have reached PROCESSING — ready to contact after packing. */
export const QUOTE_PENDING_ATTENTION = "quote-pending";
/** Every quote-pending order, including those not yet packed. */
export const QUOTE_PENDING_ALL_ATTENTION = "quote-pending-all";
/** Guest custom (made-to-order) — call before cutting. */
export const GUEST_CUSTOM_ATTENTION = "guest-custom";
/** Bank transfer uploaded, waiting for admin to approve the receipt. */
export const BANK_TRANSFER_PENDING_ATTENTION = "bank-transfer-pending";

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
  return where;
}
