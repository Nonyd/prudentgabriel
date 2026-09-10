import { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function listRefundRequiredOrders() {
  return prisma.order.findMany({
    where: {
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CANCELLED,
      refundRecordedAt: null,
    },
    select: { id: true, orderNumber: true, total: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

export function oversellReportHtml(
  orders: Awaited<ReturnType<typeof listRefundRequiredOrders>>,
): string {
  if (orders.length === 0) {
    return "<p>No refund-required items.</p>";
  }
  return `<p>Outstanding paid · cancelled (refund owed):</p><ul>${orders
    .map(
      (o) =>
        `<li>#${o.orderNumber} — ₦${Math.round(o.total).toLocaleString("en-NG")}</li>`,
    )
    .join("")}</ul>`;
}
