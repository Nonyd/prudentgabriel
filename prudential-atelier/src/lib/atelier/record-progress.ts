import { BespokeStage, OrderStageStatus, StageApprovalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAGE_ORDER } from "@/lib/bespoke-stages";
import { logActivity } from "@/lib/logger";
import { sortSteps, stepLabel } from "@/lib/atelier/pipeline";
import { ensureSteps, loadSteps, syncLeadStage } from "@/lib/atelier/pipeline-db";

/**
 * Progress the house made outside the app: a client onboarded mid-commission, or one
 * with no email who can never open an approval link. The order's own steps before
 * `targetStage` (by position, skipped ones left out) are written as completeOrderStage writes them (a StageUpdate and a completion), with
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
  | { ok: true; recorded: string[]; currentStage: BespokeStage }
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
    select: { id: true, orderRef: true, status: true, archivedAt: true },
  });
  if (!order) return { ok: false, status: 404, error: "Order not found." };
  if (order.archivedAt) return { ok: false, status: 409, error: "This order is archived." };
  if (order.status === "DELIVERED") return { ok: false, status: 409, error: "This order is already delivered." };

  await ensureSteps(prisma, orderId);
  const steps = sortSteps(await loadSteps(prisma, orderId));
  const target = steps.find((s) => s.stage === targetStage);
  if (!target) return { ok: false, status: 404, error: "That step is not on this order." };
  if (target.status === OrderStageStatus.SKIPPED) {
    return { ok: false, status: 409, error: `${stepLabel(target)} is skipped on this order.` };
  }
  if (target.status === OrderStageStatus.DONE) {
    return { ok: false, status: 409, error: `${stepLabel(target)} is already done. Use “Revert stage” to reopen it.` };
  }

  const toComplete = steps.filter(
    (s) =>
      s.position < target.position &&
      s.status !== OrderStageStatus.DONE &&
      s.status !== OrderStageStatus.SKIPPED,
  );
  if (!toComplete.length && target.status === OrderStageStatus.ACTIVE) {
    return { ok: false, status: 409, error: `The order is already at ${stepLabel(target)}.` };
  }
  const byName = actor.name?.trim() || actor.email || "Admin";
  const now = new Date();

  const currentStage = await prisma.$transaction(async (tx) => {
    for (const step of toComplete) {
      const { stage } = step;
      const orderStageId = step.id;
      const given = params.stages?.[stage];
      const at = doneAt(given?.doneOn);
      const notes = given?.note?.trim() || IN_PERSON_APPROVAL[stage] || "Completed.";
      if (IN_PERSON_APPROVAL[stage]) {
        // A pending link (if one was sent) is closed; the approval is the one given in person.
        await tx.stageApproval.updateMany({
          where: { orderStageId, status: StageApprovalStatus.PENDING },
          data: { status: StageApprovalStatus.SUPERSEDED },
        });
        await tx.stageApproval.create({
          data: {
            orderId,
            orderStageId,
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
          orderStageId,
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
        data: { orderId, orderStageId, stage, completedById: actor.id, notes, ...(at ? { completedAt: at } : {}) },
      });
      await tx.orderStage.update({ where: { id: orderStageId }, data: { status: OrderStageStatus.DONE } });
    }
    if (target.status === OrderStageStatus.PENDING) {
      await tx.orderStage.update({
        where: { id: target.id },
        data: { status: OrderStageStatus.ACTIVE, startedAt: now, startedById: actor.id },
      });
    }
    if (order.status === "PENDING") {
      await tx.bespokeOrder.update({ where: { id: orderId }, data: { status: "PROCESSING" } });
    }
    return syncLeadStage(tx, orderId);
  });

  await logActivity({
    userId: actor.id,
    userEmail: actor.email ?? undefined,
    userRole: actor.role ?? undefined,
    action: "STAGE_COMPLETE",
    module: "bespoke",
    description:
      `${order.orderRef}: progress recorded by hand up to ${stepLabel(target)}` +
      (toComplete.length ? ` (${toComplete.map(stepLabel).join(", ")} done)` : "") +
      (params.reason?.trim() ? ` (${params.reason.trim()})` : ""),
    recordId: orderId,
    recordType: "BespokeOrder",
  });

  return { ok: true, recorded: toComplete.map((s) => s.id), currentStage };
}
