/**
 * Changing one commission's steps: move, skip, bring back, add, rename, remove,
 * start alongside, and mark done (work finished before it was recorded here). Callers check `bespoke.pipeline` (requireBespokeAccess
 * "pipeline"); the house rules are checked here, through pipeline.ts, so no
 * caller can step around them.
 */
import { BespokeStage, OrderStageStatus, OrderStatus, StageApprovalStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import { logActivity } from "@/lib/logger";
import {
  canStartNow,
  CUSTOM_LABEL_MAX,
  insertCustomStep,
  isCustomStep,
  markDoneBlockers,
  moveStep,
  skipBlockers,
  stepLabel,
  stepsToActivate,
  stepsToMarkDone,
  type PipelineFailure,
  type PipelineStep,
} from "@/lib/atelier/pipeline";
import { ensureSteps, loadSteps, syncLeadStage, writePositions } from "@/lib/atelier/pipeline-db";
import { doneAt, writeStepDone } from "@/lib/atelier/record-progress";

export type PipelineEdit =
  | { action: "move"; stepId: string; direction: "up" | "down" }
  | { action: "skip"; stepId: string; reason: string }
  | { action: "unskip"; stepId: string }
  | {
      action: "add";
      afterStepId: string;
      label: string;
      clientDescription?: string | null;
      requiresNotes?: boolean;
      minMediaCount?: number;
      requiresClientApproval?: boolean;
    }
  | {
      action: "edit";
      stepId: string;
      label?: string | null;
      clientDescription?: string | null;
      requiresNotes?: boolean;
      minMediaCount?: number;
      requiresClientApproval?: boolean;
    }
  | { action: "remove"; stepId: string }
  | { action: "start"; stepId: string }
  | {
      action: "done";
      stepId: string;
      /** Also mark the open steps before this one done. */
      withEarlier?: boolean;
      /** What she reads for it; default "Completed." (or "approved in person"). */
      note?: string | null;
      /** YYYY-MM-DD it was done, if not today. */
      doneOn?: string | null;
    };

export type PipelineActor = { id: string; email?: string | null; role?: string | null; name?: string | null };

export type PipelineEditResult =
  | { ok: true; currentStage: BespokeStage }
  | { ok: false; status: number; failures: PipelineFailure[] };

const fail = (status: number, code: PipelineFailure["code"], message: string): PipelineEditResult => ({
  ok: false,
  status,
  failures: [{ code, message }],
});

function cleanDescription(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text.slice(0, 600) : null;
}

function mediaCount(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Math.min(10, Math.max(0, Math.floor(Number(value) || 0)));
}

function describe(edit: PipelineEdit, step: PipelineStep | undefined, label?: string): string {
  const name = label ?? (step ? stepLabel(step) : "a step");
  switch (edit.action) {
    case "move":
      return `moved ${name} ${edit.direction}`;
    case "skip":
      return `skipped ${name}: ${edit.reason.trim()}`;
    case "unskip":
      return `brought back ${name}`;
    case "add":
      return `added ${name}`;
    case "edit":
      return `edited ${name}`;
    case "remove":
      return `removed ${name}`;
    case "start":
      return `started ${name} alongside the steps under way`;
    case "done":
      return `marked ${name} done${edit.withEarlier ? " (and the open steps before it)" : ""}`;
  }
}

export async function editOrderSteps(params: {
  orderId: string;
  edit: PipelineEdit;
  actor: PipelineActor;
}): Promise<PipelineEditResult> {
  const { orderId, edit, actor } = params;
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderRef: true, status: true, productionUnlockedAt: true },
  });
  if (!order) return fail(404, "STEP_NOT_FOUND", "Order not found.");
  if (order.status === OrderStatus.ARCHIVED) return fail(400, "STEP_LOCKED", "Archived orders are read-only.");
  if (order.status === OrderStatus.DELIVERED) return fail(409, "STEP_LOCKED", "This order is delivered.");

  await ensureSteps(prisma, orderId);
  const steps = await loadSteps(prisma, orderId);
  const stepId = "stepId" in edit ? edit.stepId : edit.afterStepId;
  const step = steps.find((s) => s.id === stepId);
  if (!step) return fail(404, "STEP_NOT_FOUND", "Step not found.");
  const now = new Date();
  let logLabel: string | undefined;

  const run = async (body: (tx: Prisma.TransactionClient) => Promise<void>): Promise<BespokeStage> =>
    prisma.$transaction(async (tx) => {
      await body(tx);
      // If the change left nothing running (the only step under way was skipped), start the next.
      const after = await loadSteps(tx, orderId);
      const toStart = stepsToActivate(after, Boolean(order.productionUnlockedAt));
      if (toStart.length) {
        await tx.orderStage.updateMany({
          where: { id: { in: toStart } },
          data: { status: OrderStageStatus.ACTIVE, startedAt: now, startedById: actor.id },
        });
      }
      return syncLeadStage(tx, orderId);
    }, INTERACTIVE_TX);

  let currentStage: BespokeStage;
  switch (edit.action) {
    case "move": {
      const moved = moveStep(steps, step.id, edit.direction);
      if (!moved.ok) return { ok: false, status: 422, failures: moved.failures };
      currentStage = await run((tx) => writePositions(tx, orderId, moved.steps));
      break;
    }
    case "skip": {
      const blockers = skipBlockers(step, edit.reason);
      if (blockers.length) return { ok: false, status: 422, failures: blockers };
      currentStage = await run(async (tx) => {
        await tx.orderStage.update({
          where: { id: step.id },
          data: {
            status: OrderStageStatus.SKIPPED,
            skippedAt: now,
            skippedById: actor.id,
            skippedReason: edit.reason.trim(),
            startedAt: null,
            startedById: null,
          },
        });
        // A link sent to the client for this step no longer applies.
        await tx.stageApproval.updateMany({
          where: { orderStageId: step.id, status: StageApprovalStatus.PENDING },
          data: { status: StageApprovalStatus.SUPERSEDED },
        });
      });
      break;
    }
    case "unskip": {
      if (step.status !== OrderStageStatus.SKIPPED) {
        return fail(422, "STEP_NOT_PENDING", `${stepLabel(step)} is not skipped.`);
      }
      currentStage = await run(async (tx) => {
        await tx.orderStage.update({
          where: { id: step.id },
          data: { status: OrderStageStatus.PENDING, skippedAt: null, skippedById: null, skippedReason: null },
        });
      });
      break;
    }
    case "add": {
      const label = edit.label?.trim() ?? "";
      const placeholder: PipelineStep = {
        id: "__new__",
        position: 0,
        stage: BespokeStage.CUSTOM,
        label,
        clientDescription: cleanDescription(edit.clientDescription),
        status: OrderStageStatus.PENDING,
        requiresNotes: edit.requiresNotes ?? true,
        minMediaCount: mediaCount(edit.minMediaCount) ?? 0,
        requiresClientApproval: edit.requiresClientApproval ?? false,
      };
      const placed = insertCustomStep(steps, step.id, placeholder);
      if (!placed.ok) return { ok: false, status: 422, failures: placed.failures };
      logLabel = label;
      currentStage = await run(async (tx) => {
        const position = placed.steps.find((s) => s.id === placeholder.id)!.position;
        // Make room: the existing steps take their new places first (two passes, see writePositions).
        await writePositions(
          tx,
          orderId,
          placed.steps.filter((s) => s.id !== placeholder.id),
        );
        await tx.orderStage.create({
          data: {
            orderId,
            position,
            stage: BespokeStage.CUSTOM,
            label,
            clientDescription: placeholder.clientDescription,
            requiresNotes: placeholder.requiresNotes,
            minMediaCount: placeholder.minMediaCount,
            requiresClientApproval: placeholder.requiresClientApproval,
            createdById: actor.id,
          },
        });
      });
      break;
    }
    case "edit": {
      const label = edit.label === undefined ? undefined : edit.label?.trim() || null;
      if (isCustomStep(step) && label === null) {
        return fail(422, "LABEL_REQUIRED", "A custom step needs a name.");
      }
      if (label && label.length > CUSTOM_LABEL_MAX) {
        return fail(422, "LABEL_REQUIRED", `Keep the name under ${CUSTOM_LABEL_MAX} characters.`);
      }
      const custom = isCustomStep(step);
      if (!custom && (edit.requiresNotes !== undefined || edit.minMediaCount !== undefined || edit.requiresClientApproval !== undefined)) {
        return fail(422, "STEP_LOCKED", "A built-in step keeps the house's requirements.");
      }
      if (custom && step.status === OrderStageStatus.DONE && edit.requiresClientApproval !== undefined) {
        return fail(422, "STEP_DONE", `${stepLabel(step)} is done; its requirements stay as they were.`);
      }
      currentStage = await run(async (tx) => {
        await tx.orderStage.update({
          where: { id: step.id },
          data: {
            ...(label !== undefined ? { label } : {}),
            ...(edit.clientDescription !== undefined ? { clientDescription: cleanDescription(edit.clientDescription) } : {}),
            ...(custom && edit.requiresNotes !== undefined ? { requiresNotes: edit.requiresNotes } : {}),
            ...(custom && edit.minMediaCount !== undefined ? { minMediaCount: mediaCount(edit.minMediaCount) } : {}),
            ...(custom && edit.requiresClientApproval !== undefined
              ? { requiresClientApproval: edit.requiresClientApproval }
              : {}),
          },
        });
      });
      break;
    }
    case "remove": {
      if (!isCustomStep(step)) {
        return fail(422, "STEP_LOCKED", `${stepLabel(step)} is a built-in step: skip it instead.`);
      }
      const used = await prisma.orderStage.findUnique({
        where: { id: step.id },
        select: { _count: { select: { completions: true, media: true, approvals: true, updates: true } } },
      });
      const c = used?._count;
      if (c && (c.completions || c.media || c.approvals || c.updates)) {
        return fail(422, "STEP_DONE", `${stepLabel(step)} has work recorded on it: skip it instead.`);
      }
      currentStage = await run(async (tx) => {
        await tx.orderStage.delete({ where: { id: step.id } });
        const rest = (await loadSteps(tx, orderId)).map((s, i) => ({ ...s, position: i + 1 }));
        await writePositions(tx, orderId, rest);
      });
      break;
    }
    case "start": {
      const check = canStartNow({ step, steps, productionUnlocked: Boolean(order.productionUnlockedAt) });
      if (!check.ok) return { ok: false, status: 422, failures: check.failures };
      currentStage = await run(async (tx) => {
        await tx.orderStage.update({
          where: { id: step.id },
          data: { status: OrderStageStatus.ACTIVE, startedAt: now, startedById: actor.id },
        });
      });
      break;
    }
    case "done": {
      const blockers = markDoneBlockers(step);
      if (blockers.length) return { ok: false, status: 422, failures: blockers };
      const toMark = stepsToMarkDone(steps, step.id, Boolean(edit.withEarlier));
      const at = doneAt(edit.doneOn);
      const byName = actor.name?.trim() || actor.email || "Admin";
      currentStage = await run(async (tx) => {
        for (const s of toMark) {
          // Her words go on the step asked about; earlier ones read "Completed.".
          await writeStepDone(tx, {
            orderId,
            step: s,
            actorId: actor.id,
            byName,
            note: s.id === step.id ? edit.note : null,
            at,
          });
        }
        if (order.status === OrderStatus.PENDING) {
          await tx.bespokeOrder.update({ where: { id: orderId }, data: { status: OrderStatus.PROCESSING } });
        }
      });
      break;
    }
  }

  await logActivity({
    userId: actor.id,
    userEmail: actor.email ?? undefined,
    userRole: actor.role ?? undefined,
    action: "UPDATE",
    module: "bespoke",
    description: `${order.orderRef}: ${describe(edit, step, logLabel)}`,
    recordId: orderId,
    recordType: "BespokeOrder",
  });

  return { ok: true, currentStage };
}
