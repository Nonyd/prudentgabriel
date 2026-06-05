import type { BespokeStage, CustomerNotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";

async function resolveUserIdForBespoke(
  clientProfileId: string | null,
  clientEmail: string,
): Promise<string | null> {
  if (clientProfileId) {
    const profile = await prisma.clientProfile.findUnique({
      where: { id: clientProfileId },
      select: { userId: true },
    });
    if (profile?.userId) return profile.userId;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: clientEmail.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function createCustomerNotification(params: {
  userId: string;
  type: CustomerNotificationType;
  title: string;
  message: string;
  link?: string;
  entityId?: string;
}): Promise<void> {
  await prisma.customerNotification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
      entityId: params.entityId ?? null,
    },
  });
}

export function notifyClientBespokeStageComplete(params: {
  orderId: string;
  orderRef: string;
  stage: BespokeStage;
  trackingToken: string;
  clientProfileId: string | null;
  clientEmail: string;
}): void {
  void (async () => {
    const userId = await resolveUserIdForBespoke(params.clientProfileId, params.clientEmail);
    if (!userId) return;

    const stageLabel = STAGE_SHORT_LABELS[params.stage];
    await createCustomerNotification({
      userId,
      type: "BESPOKE_STAGE",
      title: "Atelier stage complete",
      message: `${params.orderRef} — ${stageLabel} is complete. View your commission progress.`,
      link: `/track/${params.trackingToken}`,
      entityId: params.orderId,
    });
  })().catch(() => {});
}
