import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { AccountOrdersClient } from "@/components/account/AccountOrdersClient";

export default async function AccountOrdersPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const profile = await getOrCreateClientProfile(userId);

  const [bespokeOrders, rtwOrders] = await Promise.all([
    prisma.bespokeOrder.findMany({
      where: { clientProfileId: profile.id },
      orderBy: { createdAt: "desc" },
      include: { stageHistory: { orderBy: { completedAt: "asc" } } },
    }),
    prisma.order.findMany({
      where: { userId, isBespoke: false },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: { include: { images: { take: 1 } } },
          },
        },
      },
    }),
  ]);

  return <AccountOrdersClient bespokeOrders={bespokeOrders} rtwOrders={rtwOrders} />;
}
