import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { BespokeApprovalClient } from "@/components/account/BespokeApprovalClient";
import { BespokePostDeliveryClient } from "@/components/account/BespokePostDeliveryClient";
import { BespokeStageTracker } from "@/components/bespoke/BespokeStageTracker";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { formatPrice } from "@/lib/utils";

export default async function AccountBespokeOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const session = await auth();
  const userId = session!.user!.id!;
  const profile = await getOrCreateClientProfile(userId);

  const order = await prisma.bespokeOrder.findFirst({
    where: {
      id: orderId,
      OR: [{ clientProfileId: profile.id }, { clientEmail: session!.user!.email ?? "" }],
    },
    include: {
      stageHistory: { orderBy: { completedAt: "asc" } },
      stageDrafts: true,
      stageMedia: { orderBy: { createdAt: "asc" } },
      stageApprovals: { orderBy: { requestedAt: "desc" } },
    },
  });

  if (!order) notFound();

  const draft = order.stageDrafts.find((d) => d.stage === order.currentStage);
  const media = order.stageMedia.filter((m) => m.stage === order.currentStage);
  const delivered =
    order.status === OrderStatus.DELIVERED ||
    order.status === OrderStatus.ARCHIVED ||
    !!order.deliveredAt;
  const canConfirm = delivered && !order.receiptConfirmedAt && order.status !== OrderStatus.ARCHIVED;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/account/orders" className="font-sans text-sm text-nut hover:underline">
        ← My orders
      </Link>
      <h1 className="mt-4 font-display text-3xl text-choc">{order.orderRef}</h1>
      <p className="mt-1 font-sans text-sm text-text-mid">
        {STAGE_SHORT_LABELS[order.currentStage]} · {formatPrice(order.totalAmount, "NGN")}
        {order.status === OrderStatus.ARCHIVED ? " · Archived" : null}
      </p>

      <BespokeApprovalClient
        orderId={order.id}
        orderRef={order.orderRef}
        currentStage={order.currentStage}
        notes={draft?.notes ?? null}
        media={media.map((m) => ({ id: m.id, url: m.url, kind: m.kind }))}
        approvals={order.stageApprovals}
      />

      <BespokePostDeliveryClient
        orderId={order.id}
        canConfirmReceipt={canConfirm}
        receiptConfirmedAt={order.receiptConfirmedAt?.toISOString() ?? null}
        isArchived={order.status === OrderStatus.ARCHIVED}
      />

      <div className="mt-10">
        <BespokeStageTracker currentStage={order.currentStage} stageHistory={order.stageHistory} />
      </div>
    </div>
  );
}
