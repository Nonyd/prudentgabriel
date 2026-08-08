import { prisma } from "@/lib/prisma";
import { paymentLedgerDeleteBlockedMessage, isPrismaForeignKeyError } from "@/lib/payments/ledger-delete-guard";

export const MAX_ORDERS_BULK_DELETE = 100;

/** Hard-delete orders and clean up loose references (points ledger rows, review links). */
export async function deleteOrdersByIds(ids: string[]): Promise<number> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return 0;
  if (unique.length > MAX_ORDERS_BULK_DELETE) {
    throw new Error(`Maximum ${MAX_ORDERS_BULK_DELETE} orders per request`);
  }

  // Pre-check Payment ledger — RESTRICT would otherwise throw a raw FK error.
  const withPayments = await prisma.payment.findMany({
    where: { orderId: { in: unique } },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  if (withPayments.length > 0) {
    throw new Error(paymentLedgerDeleteBlockedMessage("order"));
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.pointsTransaction.deleteMany({ where: { orderId: { in: unique } } });
      await tx.review.updateMany({ where: { orderId: { in: unique } }, data: { orderId: null } });
      const { count } = await tx.order.deleteMany({ where: { id: { in: unique } } });
      return count;
    });
  } catch (e) {
    if (isPrismaForeignKeyError(e)) {
      throw new Error(paymentLedgerDeleteBlockedMessage("order"));
    }
    throw e;
  }
}
