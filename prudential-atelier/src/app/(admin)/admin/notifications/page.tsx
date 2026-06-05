import { prisma } from "@/lib/prisma";
import { NotificationsPageClient } from "@/components/admin/NotificationsPageClient";

const PAGE_SIZE = 20;

export default async function AdminNotificationsPage() {
  const [notifications, unreadCount] = await Promise.all([
    prisma.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.adminNotification.count({ where: { isRead: false } }),
  ]);

  return <NotificationsPageClient initialNotifications={notifications} initialUnreadCount={unreadCount} pageSize={PAGE_SIZE} />;
}
