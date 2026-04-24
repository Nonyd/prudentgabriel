import { NextResponse } from "next/server";
import { AdminNotificationType } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const notifications = await prisma.adminNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const unreadOf = (t: AdminNotificationType) =>
    notifications.filter((n) => !n.isRead && n.type === t).length;

  return NextResponse.json({
    notifications,
    unreadCount,
    counts: {
      orders: unreadOf("NEW_ORDER"),
      bespoke: unreadOf("NEW_BESPOKE"),
      consultations: unreadOf("NEW_CONSULTATION"),
      reviews: unreadOf("REVIEW_PENDING"),
      lowStock: unreadOf("LOW_STOCK"),
      paymentFailed: unreadOf("PAYMENT_FAILED"),
    },
  });
}
