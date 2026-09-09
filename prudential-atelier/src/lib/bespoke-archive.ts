import { AlterationStatus, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  OPEN_ALTERATION_STATUSES,
  alterationWindowClosesAt,
  getAlterationWarrantyDays,
  isAlterationWindowOpen,
} from "@/lib/alterations/policy";
import { balanceIsCleared } from "@/lib/money";

export { isAlterationWindowOpen, alterationWindowClosesAt };

/**
 * A commission stays active until she has confirmed receipt and the alteration
 * window has actually closed. Archived and cancelled are never active.
 */
export function isBespokeCommissionActive(params: {
  status: OrderStatus | string;
  receiptConfirmedAt: Date | string | null;
  warrantyDays: number;
  now?: Date;
}): boolean {
  if (params.status === OrderStatus.ARCHIVED || params.status === "ARCHIVED") return false;
  if (params.status === OrderStatus.CANCELLED || params.status === "CANCELLED") return false;
  const confirmed =
    params.receiptConfirmedAt instanceof Date
      ? params.receiptConfirmedAt
      : params.receiptConfirmedAt
        ? new Date(params.receiptConfirmedAt)
        : null;
  if (!confirmed) return true;
  return isAlterationWindowOpen({
    receiptConfirmedAt: confirmed,
    warrantyDays: params.warrantyDays,
    now: params.now,
  });
}

export function archiveReasonForWindow(params: {
  warrantyDays: number;
  windowClosedAt: Date;
}): string {
  const closed = params.windowClosedAt.toISOString().slice(0, 10);
  return `Alteration window ended on ${closed} (${params.warrantyDays} days after receipt was confirmed). No open requests.`;
}

/**
 * Archive only after receipt is confirmed AND the alteration window has elapsed,
 * with a zero-enough balance and no open alterations. Confirming receipt must not
 * call this into effect on the same day.
 */
export async function maybeArchiveBespokeOrder(
  orderId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      balance: true,
      receiptConfirmedAt: true,
      deliveredAt: true,
    },
  });
  if (!order) return false;
  if (order.status === OrderStatus.ARCHIVED) return true;
  if (order.status !== OrderStatus.DELIVERED && !order.deliveredAt) return false;
  if (!order.receiptConfirmedAt) return false;
  if (!balanceIsCleared(order.balance)) return false;

  const warrantyDays = await getAlterationWarrantyDays();
  if (
    isAlterationWindowOpen({
      receiptConfirmedAt: order.receiptConfirmedAt,
      warrantyDays,
      now,
    })
  ) {
    return false;
  }

  const open = await prisma.alterationRequest.count({
    where: {
      orderId,
      status: { in: [...OPEN_ALTERATION_STATUSES] as AlterationStatus[] },
    },
  });
  if (open > 0) return false;

  const windowClosedAt = alterationWindowClosesAt(order.receiptConfirmedAt, warrantyDays);
  const reason = archiveReasonForWindow({ warrantyDays, windowClosedAt });

  await prisma.bespokeOrder.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.ARCHIVED,
      archivedAt: now,
      archivedReason: reason,
    },
  });
  return true;
}

export async function assertBespokeOrderWritable(orderId: string): Promise<void> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) throw new Error("NOT_FOUND");
  if (order.status === OrderStatus.ARCHIVED) throw new Error("ARCHIVED");
}
