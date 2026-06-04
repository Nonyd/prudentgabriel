import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { MoodboardsClient } from "@/components/account/MoodboardsClient";

export default async function MoodboardsPage() {
  const session = await auth();
  const profile = await getOrCreateClientProfile(session!.user!.id!);
  const [moodboards, bespokeOrders] = await Promise.all([
    prisma.moodboard.findMany({
      where: { clientId: profile.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bespokeOrder.findMany({
      where: { clientProfileId: profile.id },
      select: { id: true, orderRef: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return <MoodboardsClient initial={moodboards} bespokeOrders={bespokeOrders} />;
}
