import { StageApprovalStatus, type StageMediaKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";

/** Public stage-approval DTO — the stage, atelier notes, photographs. No client record. */
export type PublicStageApprovalPayload = {
  orderRef: string;
  stage: string;
  stageLabel: string;
  notes: string | null;
  media: { id: string; url: string; kind: StageMediaKind }[];
  status: StageApprovalStatus;
};

export function publicStageApprovalOmitsClientRecord(payload: Record<string, unknown>): boolean {
  const forbidden = [
    "clientEmail",
    "clientPhone",
    "clientAddress",
    "clientCity",
    "clientInstagram",
    "clientCountry",
    "clientName",
    "addresseeName",
  ];
  return forbidden.every((key) => !(key in payload) || payload[key] == null);
}

export async function loadPublicStageApproval(token: string): Promise<PublicStageApprovalPayload | null> {
  const approval = await prisma.stageApproval.findUnique({
    where: { publicToken: token },
    select: {
      stage: true,
      status: true,
      order: { select: { id: true, orderRef: true } },
    },
  });
  if (!approval) return null;

  const [draft, media] = await Promise.all([
    prisma.orderStageDraft.findUnique({
      where: { orderId_stage: { orderId: approval.order.id, stage: approval.stage } },
      select: { notes: true },
    }),
    prisma.orderStageMedia.findMany({
      where: { orderId: approval.order.id, stage: approval.stage },
      orderBy: { createdAt: "asc" },
      select: { id: true, url: true, kind: true },
    }),
  ]);

  const payload: PublicStageApprovalPayload = {
    orderRef: approval.order.orderRef,
    stage: approval.stage,
    stageLabel: STAGE_SHORT_LABELS[approval.stage],
    notes: draft?.notes?.trim() || null,
    media,
    status: approval.status,
  };

  return payload;
}
