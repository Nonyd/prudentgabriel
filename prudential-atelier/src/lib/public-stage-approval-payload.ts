import { StageApprovalStatus, type StageMediaKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stepLabel } from "@/lib/atelier/pipeline";
import { findStageApprovalByPublicToken } from "@/lib/capability-token-lookup";

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

export async function loadPublicStageApproval(
  token: string,
): Promise<
  | { ok: true; payload: PublicStageApprovalPayload }
  | { ok: false; reason: "missing" | "expired" }
> {
  const found = await findStageApprovalByPublicToken(token);
  if (!found.ok) return { ok: false, reason: found.reason };

  const approval = await prisma.stageApproval.findUnique({
    where: { id: found.approval.id },
    select: {
      stage: true,
      orderStageId: true,
      orderStage: { select: { stage: true, label: true } },
      status: true,
      order: { select: { id: true, orderRef: true } },
    },
  });
  if (!approval) return { ok: false, reason: "missing" };

  const [draft, media] = await Promise.all([
    prisma.orderStageDraft.findUnique({
      where: { orderStageId: approval.orderStageId },
      select: { notes: true },
    }),
    prisma.orderStageMedia.findMany({
      where: { orderStageId: approval.orderStageId },
      orderBy: { createdAt: "asc" },
      select: { id: true, url: true, kind: true },
    }),
  ]);

  const payload: PublicStageApprovalPayload = {
    orderRef: approval.order.orderRef,
    stage: approval.stage,
    stageLabel: stepLabel(approval.orderStage),
    notes: draft?.notes?.trim() || null,
    media,
    status: approval.status,
  };

  return { ok: true, payload };
}
