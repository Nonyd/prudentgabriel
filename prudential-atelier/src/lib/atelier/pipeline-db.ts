/**
 * Reading and writing one commission's steps (OrderStage). The rules are in
 * pipeline.ts; this file only loads rows, saves positions and keeps
 * BespokeOrder.currentStage on the lead step.
 */
import { BespokeStage, OrderStageStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultSteps, leadStage, type PipelineStep } from "@/lib/atelier/pipeline";

type Db = Prisma.TransactionClient | typeof prisma;

export const PIPELINE_STEP_SELECT = {
  id: true,
  position: true,
  stage: true,
  label: true,
  clientDescription: true,
  status: true,
  requiresNotes: true,
  minMediaCount: true,
  requiresClientApproval: true,
} satisfies Prisma.OrderStageSelect;

export function loadSteps(db: Db, orderId: string): Promise<PipelineStep[]> {
  return db.orderStage.findMany({
    where: { orderId },
    select: PIPELINE_STEP_SELECT,
    orderBy: { position: "asc" },
  });
}

/** Nested-create rows for a new order: the thirteen built-in steps, `activeStage` under way. */
export function newOrderSteps(activeStage: BespokeStage): Prisma.OrderStageCreateWithoutOrderInput[] {
  const now = new Date();
  return defaultSteps({ activeStage }).map((row) => ({
    ...row,
    startedAt: row.status === OrderStageStatus.PENDING ? null : now,
  }));
}

/**
 * An order made before steps existed, or by a script that wrote the order alone,
 * gets its steps here — the same rule as the 20261026b backfill: a live completion
 * or a place before currentStage is done, currentStage is under way.
 */
export async function ensureSteps(db: Db, orderId: string): Promise<void> {
  if (await db.orderStage.count({ where: { orderId } })) return;
  const order = await db.bespokeOrder.findUnique({
    where: { id: orderId },
    select: {
      currentStage: true,
      stageCompletions: { where: { revertedAt: null }, select: { stage: true } },
    },
  });
  if (!order) return;
  const now = new Date();
  await db.orderStage.createMany({
    data: defaultSteps({
      activeStage: order.currentStage,
      doneStages: order.stageCompletions.map((c) => c.stage),
    }).map((row) => ({ ...row, orderId, startedAt: row.status === OrderStageStatus.PENDING ? null : now })),
    skipDuplicates: true,
  });
}

/**
 * The step an action is about: the one asked for, or — for callers that still
 * name no step — the lead step (the first active one).
 */
export async function resolveStep(
  db: Db,
  orderId: string,
  orderStageId?: string | null,
): Promise<PipelineStep | null> {
  await ensureSteps(db, orderId);
  if (orderStageId) {
    return db.orderStage.findFirst({ where: { id: orderStageId, orderId }, select: PIPELINE_STEP_SELECT });
  }
  const steps = await loadSteps(db, orderId);
  return (
    steps.find((s) => s.status === OrderStageStatus.ACTIVE) ??
    steps.find((s) => s.status === OrderStageStatus.PENDING) ??
    null
  );
}

/** Save new positions. Two passes, so the (orderId, position) unique index never sees a clash. */
export async function writePositions(
  tx: Prisma.TransactionClient,
  orderId: string,
  ordered: readonly { id: string; position: number }[],
): Promise<void> {
  for (const s of ordered) {
    await tx.orderStage.update({ where: { id: s.id }, data: { position: -s.position } });
  }
  for (const s of ordered) {
    await tx.orderStage.update({ where: { id: s.id }, data: { position: s.position } });
  }
}

/** Set BespokeOrder.currentStage to the lead step. Call after any step changes. */
export async function syncLeadStage(tx: Prisma.TransactionClient, orderId: string): Promise<BespokeStage> {
  const steps = await loadSteps(tx, orderId);
  const stage = leadStage(steps);
  await tx.bespokeOrder.update({ where: { id: orderId }, data: { currentStage: stage } });
  return stage;
}

/** The thirteen built-in steps for a new order. */
export async function createDefaultSteps(
  tx: Prisma.TransactionClient,
  params: { orderId: string; activeStage: BespokeStage; doneStages?: Iterable<BespokeStage> },
): Promise<Map<BespokeStage, string>> {
  const now = new Date();
  const rows = defaultSteps(params);
  const ids = new Map<BespokeStage, string>();
  for (const row of rows) {
    const created = await tx.orderStage.create({
      data: {
        orderId: params.orderId,
        position: row.position,
        stage: row.stage,
        status: row.status,
        startedAt: row.status === OrderStageStatus.PENDING ? null : now,
      },
      select: { id: true },
    });
    ids.set(row.stage, created.id);
  }
  return ids;
}

/** The built-in step of this kind on this order (null for CUSTOM: name the step). */
export async function builtInStepId(db: Db, orderId: string, stage: BespokeStage): Promise<string | null> {
  if (stage === BespokeStage.CUSTOM) return null;
  const row = await db.orderStage.findFirst({ where: { orderId, stage }, select: { id: true } });
  return row?.id ?? null;
}
