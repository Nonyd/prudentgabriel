import { BespokeStage, StageApprovalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAGE_ORDER, STAGE_LABELS } from "@/lib/bespoke-stages";
import { logActivity } from "@/lib/logger";

/**
 * Progress the house made outside the app: a client onboarded mid-commission, or one
 * with no email who can never open an approval link. The stages before `targetStage`
 * are written as completeOrderStage writes them (a StageUpdate and a completion), with
 * no media or client-approval gate. Design Approval and Final Fitting are recorded as
 * given in person, by name. Nothing is emailed.
 *
 * Moving backwards is revertOrderStage's job; this only moves forward.
 */

/** The first stage a converted commission is at; intake is completed at convert. */
export const FIRST_PRODUCTION_STAGE = BespokeStage.SKETCHING_CONCEPT;

/** Stages that can be "where she is now": Sketching to Delivery (Delivery itself is completed in the app). */
export const RECORDABLE_TARGETS: BespokeStage[] = STAGE_ORDER.slice(STAGE_ORDER.indexOf(FIRST_PRODUCTION_STAGE));

const IN_PERSON_APPROVAL: Partial<Record<BespokeStage, string>> = {
  [BespokeStage.DESIGN_APPROVAL]: "Design approved in person.",
  [BespokeStage.FINAL_FITTING]: "Final fitting approved in person.",
};

export type StageRecord = { note?: string | null; doneOn?: string | null };

export type RecordProgressActor = { id: string; name?: string | null; email?: string | null; role?: string | null };

export type RecordProgressResult =
  | { ok: true; recorded: BespokeStage[]; currentStage: BespokeStage }
  | { ok: false; status: number; error: string };

function doneAt(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value);
  return Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000 ? undefined : d;
}

export async function recordProgressOutsideApp(params: {
  orderId: string;
  targetStage: BespokeStage;
  actor: RecordProgressActor;
  /** Per stage being completed; a stage without one is "Completed." */
  stages?: Partial<Record<BespokeStage, StageRecord>>;
  /** Why this was recorded by hand; kept in the activity log. */
  reason?: string | null;
}): Promise<RecordProgressResult> {
  const { orderId, targetStage, actor } = params;
  if (!RECORDABLE_TARGETS.includes(targetStage)) {
    return { ok: false, status: 400, error: "Choose a stage from Sketching to Delivery." };
  }
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderRef: true, currentStage: true, status: true, archivedAt: true },
  });
  if (!order) return { ok: false, status: 404, error: "Order not found." };
  if (order.archivedAt) return { ok: false, status: 409, error: "This order is archived." };
  if (order.status === "DELIVERED") return { ok: false, status: 409, error: "This order is already delivered." };

  const from = STAGE_ORDER.indexOf(order.currentStage);
  const to = STAGE_ORDER.indexOf(targetStage);
  if (to === from) return { ok: false, status: 409, error: `The order is already at ${STAGE_LABELS[targetStage]}.` };
  if (to < from) {
    return { ok: false, status: 409, error: "That stage is behind where the order is. Use “Revert stage” to move it back." };
  }

  const toComplete = STAGE_ORDER.slice(from, to);
  const byName = actor.name?.trim() || actor.email || "Admin";

  await prisma.$transaction(async (tx) => {
    for (const stage of toComplete) {
      const done = await tx.orderStageCompletion.findFirst({ where: { orderId, stage, revertedAt: null }, select: { id: true } });
      if (done) continue;
      const given = params.stages?.[stage];
      const at = doneAt(given?.doneOn);
      const notes = given?.note?.trim() || IN_PERSON_APPROVAL[stage] || "Completed.";
      if (IN_PERSON_APPROVAL[stage]) {
        // A pending link (if one was sent) is closed; the approval is the one given in person.
        await tx.stageApproval.updateMany({
          where: { orderId, stage, status: StageApprovalStatus.PENDING },
          data: { status: StageApprovalStatus.SUPERSEDED },
        });
        await tx.stageApproval.create({
          data: {
            orderId,
            stage,
            status: StageApprovalStatus.APPROVED,
            requestedById: actor.id,
            requestedAt: at ?? new Date(),
            respondedAt: at ?? new Date(),
            clientComment: `Given in person; recorded by ${byName}.`,
          },
        });
      }
      await tx.stageUpdate.create({
        data: {
          orderId,
          stage,
          notes,
          images: [],
          videos: [],
          completedBy: actor.id,
          completedByName: byName,
          ...(at ? { completedAt: at } : {}),
        },
      });
      await tx.orderStageCompletion.create({
        data: { orderId, stage, completedById: actor.id, notes, ...(at ? { completedAt: at } : {}) },
      });
    }
    await tx.bespokeOrder.update({
      where: { id: orderId },
      data: { currentStage: targetStage, ...(order.status === "PENDING" ? { status: "PROCESSING" } : {}) },
    });
  });

  await logActivity({
    userId: actor.id,
    userEmail: actor.email ?? undefined,
    userRole: actor.role ?? undefined,
    action: "STAGE_COMPLETE",
    module: "bespoke",
    description:
      `${order.orderRef}: progress recorded by hand, ${STAGE_LABELS[order.currentStage]} → ${STAGE_LABELS[targetStage]}` +
      (params.reason?.trim() ? ` (${params.reason.trim()})` : ""),
    recordId: orderId,
    recordType: "BespokeOrder",
  });

  return { ok: true, recorded: toComplete, currentStage: targetStage };
}
