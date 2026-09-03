import { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FULFILMENT_STOCK_REFUSE_NOTE } from "@/lib/stock-ledger";

export async function listRefundRequiredOrders() {
  return prisma.order.findMany({
    where: {
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CANCELLED,
      adminNotes: { contains: FULFILMENT_STOCK_REFUSE_NOTE },
    },
    select: { id: true, orderNumber: true, total: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

export async function listTodayOversellNotifications(from: Date, to: Date) {
  return prisma.adminNotification.findMany({
    where: {
      type: "RTW_OVERSELL",
      createdAt: { gte: from, lte: to },
    },
    select: { id: true, title: true, message: true, entityId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export function oversellReportHtml(
  orders: Awaited<ReturnType<typeof listRefundRequiredOrders>>,
  notices: Awaited<ReturnType<typeof listTodayOversellNotifications>>,
): string {
  if (orders.length === 0 && notices.length === 0) {
    return "<p>No RTW oversell / refund-required items.</p>";
  }
  const orderList =
    orders.length === 0
      ? ""
      : `<p>Outstanding paid · cancelled (refund owed):</p><ul>${orders
          .map(
            (o) =>
              `<li>#${o.orderNumber} — ₦${Math.round(o.total).toLocaleString("en-NG")}</li>`,
          )
          .join("")}</ul>`;
  const noticeList =
    notices.length === 0
      ? ""
      : `<p>Oversell notices today:</p><ul>${notices
          .map((n) => `<li>${n.title} — ${n.message}</li>`)
          .join("")}</ul>`;
  return `${orderList}${noticeList}`;
}
