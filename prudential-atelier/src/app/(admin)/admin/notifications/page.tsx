import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveSessionAccess } from "@/lib/admin-auth";
import { NotificationsPageClient } from "@/components/admin/NotificationsPageClient";
import {
  adminNotificationListInclude,
  adminNotificationUnreadWhere,
  adminNotificationVisibleWhere,
  serializeAdminNotification,
} from "@/lib/admin-notification-access";

const PAGE_SIZE = 20;

export default async function AdminNotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { role, actor } = await resolveSessionAccess(session);
  const userId = session.user.id;

  const [notifications, unreadCount] = await Promise.all([
    prisma.adminNotification.findMany({
      where: adminNotificationVisibleWhere(role, actor),
      include: adminNotificationListInclude(userId),
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.adminNotification.count({
      where: adminNotificationUnreadWhere(userId, role, actor),
    }),
  ]);

  return (
    <NotificationsPageClient
      initialNotifications={notifications.map(serializeAdminNotification)}
      initialUnreadCount={unreadCount}
      pageSize={PAGE_SIZE}
    />
  );
}
