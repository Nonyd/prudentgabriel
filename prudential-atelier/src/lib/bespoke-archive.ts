import { AlterationStatus, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OPEN_ALTERATION_STATUSES } from "@/lib/alterations/policy";

/**
 * Archive when delivered, receipt confirmed, balance zero, and no open alterations.
 */
export async function maybeArchiveBespokeOrder(orderId: string): Promise<boolean> {
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
  if (order.balance > 0.01) return false;

  const open = await prisma.alterationRequest.count({
    where: {
      orderId,
      status: { in: [...OPEN_ALTERATION_STATUSES] as AlterationStatus[] },
    },
  });
  if (open > 0) return false;

  await prisma.bespokeOrder.update({
    where: { id: orderId },
    data: { status: OrderStatus.ARCHIVED },
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
