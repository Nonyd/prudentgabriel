import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { AccountOrdersClient } from "@/components/account/AccountOrdersClient";
import { clientStepHistory } from "@/lib/atelier/live-stages";
import { clientSteps, CLIENT_STEP_SELECT } from "@/lib/atelier/pipeline";
import { clientMediaSrcs } from "@/lib/media/client-media-src";

export default async function AccountOrdersPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const profile = await getOrCreateClientProfile(userId);

  const [bespokeOrders, rtwOrders] = await Promise.all([
    prisma.bespokeOrder.findMany({
      where: { clientProfileId: profile.id },
      orderBy: { createdAt: "desc" },
      include: {
        stageHistory: { orderBy: { completedAt: "asc" } },
        steps: { orderBy: { position: "asc" }, select: CLIENT_STEP_SELECT },
        consultation: { select: { bookingNumber: true } },
      },
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

  return (
    <AccountOrdersClient
      bespokeOrders={bespokeOrders.map((o) => {
        // Her order's real steps: skipped ones left out, added ones by their name.
        const steps = clientSteps(o.steps);
        return {
          ...o,
          steps,
          moodboardImages: clientMediaSrcs(o.moodboardImages),
          stageHistory: clientStepHistory(
            o.stageHistory,
            steps.filter((s) => s.status === "DONE").map((s) => s.id),
          ),
        };
      })}
      rtwOrders={rtwOrders}
    />
  );
}
