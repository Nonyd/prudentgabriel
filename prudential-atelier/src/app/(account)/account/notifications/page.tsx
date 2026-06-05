import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CustomerNotificationsPageClient } from "@/components/account/CustomerNotificationsPageClient";

export default async function AccountNotificationsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/account/notifications");

  const notifications = await prisma.customerNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return <CustomerNotificationsPageClient initialNotifications={notifications} />;
}
