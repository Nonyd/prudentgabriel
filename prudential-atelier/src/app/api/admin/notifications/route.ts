import { NextResponse } from "next/server";
import { AdminNotificationType } from "@prisma/client";
import { requireAdminPortalApi, resolveSessionAccess } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  adminNotificationListInclude,
  adminNotificationUnreadWhere,
  adminNotificationVisibleWhere,
  serializeAdminNotification,
} from "@/lib/admin-notification-access";

export async function GET() {
  const gate = await requireAdminPortalApi();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, actor } = await resolveSessionAccess(gate.session);

  const where = adminNotificationVisibleWhere(role, actor);

  const [notifications, unreadCount] = await Promise.all([
    prisma.adminNotification.findMany({
      where,
      include: adminNotificationListInclude(userId),
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.adminNotification.count({ where: adminNotificationUnreadWhere(userId, role, actor) }),
  ]);

  const rows = notifications.map(serializeAdminNotification);

  const unreadOf = (t: AdminNotificationType) =>
    rows.filter((n) => !n.isRead && !n.acknowledgedAt && n.type === t).length;

  return NextResponse.json({
    notifications: rows,
    unreadCount,
    counts: {
      orders: unreadOf("NEW_ORDER") + unreadOf("BANK_TRANSFER_RECEIPT"),
      bespoke: unreadOf("NEW_BESPOKE") + unreadOf("STAGE_COMPLETED") + unreadOf("QUOTE_APPROVED"),
      consultations: unreadOf("NEW_CONSULTATION") + unreadOf("CONSULTATION_COMPLETED"),
      reviews: unreadOf("REVIEW_PENDING") + unreadOf("TESTIMONIAL_SUBMITTED"),
      lowStock: unreadOf("LOW_STOCK"),
      paymentFailed: unreadOf("PAYMENT_FAILED"),
      oversell: unreadOf("RTW_OVERSELL"),
    },
  });
}
