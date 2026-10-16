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
  if (!gate.session.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // While viewing as someone, their alerts (named ones included) and their unread state.
  const { role, actor, user } = await resolveSessionAccess(gate.session);
  const userId = user.id;

  const where = adminNotificationVisibleWhere(role, actor, userId);

  const unreadWhere = adminNotificationUnreadWhere(userId, role, actor);
  const [notifications, unreadCount, unreadByType] = await Promise.all([
    prisma.adminNotification.findMany({
      where,
      include: adminNotificationListInclude(userId),
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.adminNotification.count({ where: unreadWhere }),
    // Section badges count every unread row, not just the 50 in the list.
    prisma.adminNotification.groupBy({ by: ["type"], where: unreadWhere, _count: { _all: true } }),
  ]);

  const rows = notifications.map(serializeAdminNotification);

  const unreadTotals = new Map(unreadByType.map((g) => [g.type, g._count._all]));
  const unreadOf = (t: AdminNotificationType) => unreadTotals.get(t) ?? 0;

  return NextResponse.json({
    notifications: rows,
    unreadCount,
    counts: {
      orders: unreadOf("NEW_ORDER") + unreadOf("BANK_TRANSFER_RECEIPT"),
      bespoke: unreadOf("NEW_BESPOKE") + unreadOf("STAGE_COMPLETED") + unreadOf("QUOTE_APPROVED"),
      consultations: unreadOf("NEW_CONSULTATION") + unreadOf("CONSULTATION_COMPLETED"),
      reviews: unreadOf("REVIEW_PENDING") + unreadOf("TESTIMONIAL_SUBMITTED"),
      fabricUnavailable: unreadOf("FABRIC_UNAVAILABLE"),
      paymentFailed: unreadOf("PAYMENT_FAILED"),
    },
  });
}
