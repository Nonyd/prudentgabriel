/** Shared admin order-list filters (page + CSV API). */
import { OrderStatus, PaymentStatus, type Prisma } from "@prisma/client";

export const REFUND_REQUIRED_ATTENTION = "refund-required";

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
  if (attention !== REFUND_REQUIRED_ATTENTION) return where;
  return {
    ...where,
    status: OrderStatus.CANCELLED,
    paymentStatus: PaymentStatus.PAID,
  };
}
