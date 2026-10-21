import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { BespokeApprovalClient } from "@/components/account/BespokeApprovalClient";
import { BespokePostDeliveryClient } from "@/components/account/BespokePostDeliveryClient";
import { BespokeStageTracker } from "@/components/bespoke/BespokeStageTracker";
import { formatBespokeBook } from "@/lib/atelier-fx";
import { clientStepHistory } from "@/lib/atelier/live-stages";
import { clientSteps } from "@/lib/atelier/pipeline";
import { ensureSteps } from "@/lib/atelier/pipeline-db";
import { maybeArchiveBespokeOrder } from "@/lib/bespoke-archive";
import { provenEmail } from "@/lib/email-verification";
import {
  alterationWindowClosesAt,
  getAlterationWarrantyDays,
  isAlterationWindowOpen,
} from "@/lib/alterations/policy";

export default async function AccountBespokeOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const session = await auth();
  const userId = session!.user!.id!;
  const profile = await getOrCreateClientProfile(userId);
  // A commission staff filed under her email opens once she has proven the address.
  const email = await provenEmail(userId);

  const order = await prisma.bespokeOrder.findFirst({
    where: {
      id: orderId,
      OR: [
        { clientProfileId: profile.id },
        ...(email ? [{ clientEmail: { equals: email, mode: "insensitive" as const } }] : []),
      ],
    },
    include: {
      stageHistory: { orderBy: { completedAt: "asc" } },
      stageDrafts: true,
      stageMedia: { orderBy: { createdAt: "asc" } },
      stageApprovals: { orderBy: { requestedAt: "desc" } },
      steps: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, stage: true, label: true, clientDescription: true, status: true },
      },
    },
  });

  if (!order) notFound();
  if (!order.steps.length) {
    // An order written before steps existed: give it its steps, then read them.
    await ensureSteps(prisma, order.id);
    order.steps = await prisma.orderStage.findMany({
      where: { orderId: order.id },
      orderBy: { position: "asc" },
      select: { id: true, position: true, stage: true, label: true, clientDescription: true, status: true },
    });
  }

  await maybeArchiveBespokeOrder(order.id);
  const fresh = await prisma.bespokeOrder.findUnique({
    where: { id: order.id },
    select: { status: true, archivedReason: true },
  });
  const status = fresh?.status ?? order.status;

  // Her order's real steps; an approval waits on whichever step under way asked for it.
  const steps = clientSteps(order.steps);
  const running = steps.filter((s) => s.status === "ACTIVE");
  const pendingApproval = order.stageApprovals.find(
    (a) => a.status === "PENDING" && running.some((s) => s.id === a.orderStageId),
  );
  const approvalStep = pendingApproval ? running.find((s) => s.id === pendingApproval.orderStageId) : undefined;
  const draft = approvalStep ? order.stageDrafts.find((d) => d.orderStageId === approvalStep.id) : undefined;
  const media = approvalStep ? order.stageMedia.filter((m) => m.orderStageId === approvalStep.id) : [];
  const doneIds = steps.filter((s) => s.status === "DONE").map((s) => s.id);
  const delivered =
    status === OrderStatus.DELIVERED ||
    status === OrderStatus.ARCHIVED ||
    !!order.deliveredAt;
  const canConfirm = delivered && !order.receiptConfirmedAt && status !== OrderStatus.ARCHIVED;
  const warrantyDays = await getAlterationWarrantyDays();
  const windowOpen = isAlterationWindowOpen({
    receiptConfirmedAt: order.receiptConfirmedAt,
    warrantyDays,
  });
  const warrantyEndsAt = order.receiptConfirmedAt
    ? alterationWindowClosesAt(order.receiptConfirmedAt, warrantyDays).toISOString()
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/account/orders" className="font-sans text-sm text-nut hover:underline">
        ← My orders
      </Link>
      <h1 className="mt-4 font-display text-3xl text-choc">{order.orderRef}</h1>
      <p className="mt-1 font-sans text-sm text-text-mid">
        {running.map((s) => s.label).join(" · ") || "Delivered"} · {formatBespokeBook(order.totalAmount, order)}
        {status === OrderStatus.ARCHIVED ? " · Archived" : null}
      </p>

      <BespokeApprovalClient
        orderId={order.id}
        orderRef={order.orderRef}
        stageLabel={approvalStep?.label ?? ""}
        notes={draft?.notes ?? null}
        media={media.map((m) => ({ id: m.id, url: m.url, kind: m.kind }))}
        approvals={pendingApproval ? [pendingApproval] : []}
      />

      <BespokePostDeliveryClient
        orderId={order.id}
        canConfirmReceipt={canConfirm}
        receiptConfirmedAt={order.receiptConfirmedAt?.toISOString() ?? null}
        isArchived={status === OrderStatus.ARCHIVED}
        windowOpen={windowOpen}
        warrantyEndsAt={warrantyEndsAt}
      />

      <div className="mt-10">
        <BespokeStageTracker
          steps={steps}
          currentStage={order.currentStage}
          stageHistory={clientStepHistory(order.stageHistory, doneIds)}
        />
      </div>
    </div>
  );
}
