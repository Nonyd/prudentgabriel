import { prisma } from "@/lib/prisma";

export const MAX_ORDERS_BULK_DELETE = 100;

/** Hard-delete orders and clean up loose references (points ledger rows, review links). */
export async function deleteOrdersByIds(ids: string[]): Promise<number> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return 0;
  if (unique.length > MAX_ORDERS_BULK_DELETE) {
    throw new Error(`Maximum ${MAX_ORDERS_BULK_DELETE} orders per request`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.pointsTransaction.deleteMany({ where: { orderId: { in: unique } } });
    await tx.review.updateMany({ where: { orderId: { in: unique } }, data: { orderId: null } });
    const { count } = await tx.order.deleteMany({ where: { id: { in: unique } } });
    return count;
  });
}
