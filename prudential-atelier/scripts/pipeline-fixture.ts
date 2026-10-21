/**
 * Tests written before an order had its own steps say "the order is at X, these
 * stages are done". These helpers turn that into the thirteen built-in steps, so
 * the old assertions keep their meaning against the step engine.
 */
import { BespokeStage, OrderStageStatus, type PrismaClient } from "@prisma/client";
import { STAGE_ORDER } from "../src/lib/bespoke-stages";
import { getStageRequirement } from "../src/lib/atelier/stage-requirements";
import { buildStageChecklistFacts } from "../src/lib/atelier/stage-checklist";
import type { StageGateSnapshot } from "../src/lib/atelier/can-complete-stage";
import type { PipelineStep } from "../src/lib/atelier/pipeline";
import { builtInStepId, ensureSteps } from "../src/lib/atelier/pipeline-db";

/** The thirteen steps: `completed` done, `current` under way, the rest waiting. */
export function fixedSteps(current: BespokeStage, completed: Iterable<BespokeStage> = []): PipelineStep[] {
  const done = new Set(completed);
  return STAGE_ORDER.map((stage, i) => ({
    id: stage,
    position: i + 1,
    stage,
    label: null,
    clientDescription: null,
    status: done.has(stage)
      ? OrderStageStatus.DONE
      : stage === current
        ? OrderStageStatus.ACTIVE
        : OrderStageStatus.PENDING,
    requiresNotes: true,
    minMediaCount: 0,
    requiresClientApproval: false,
  }));
}

export type LegacySnapshot = Partial<Omit<StageGateSnapshot, "step" | "steps">> & {
  currentStage: BespokeStage;
  completedStages?: BespokeStage[];
};

/** A gate snapshot for the step at `currentStage`. */
export function legacySnapshot(p: LegacySnapshot, defaults: Partial<StageGateSnapshot> = {}): StageGateSnapshot {
  const { currentStage, completedStages = [], ...rest } = p;
  const steps = fixedSteps(currentStage, completedStages);
  const step = steps.find((s) => s.stage === currentStage)!;
  return {
    orderId: "ord_1",
    orderRef: "ORD-1001",
    productionUnlockedAt: null,
    notes: null,
    mediaCount: 0,
    latestApprovalStatus: null,
    balance: 0,
    requirement: getStageRequirement(currentStage),
    ...defaults,
    ...rest,
    step,
    steps,
  };
}

type FactsArgs = Parameters<typeof buildStageChecklistFacts>[0];

/** buildStageChecklistFacts, from "at this stage, these done". */
export function legacyFacts(
  p: Omit<FactsArgs, "step" | "steps"> & { currentStage: BespokeStage; completedStages: Iterable<BespokeStage> },
) {
  const { currentStage, completedStages, ...rest } = p;
  const steps = fixedSteps(currentStage, completedStages);
  return buildStageChecklistFacts({ ...rest, steps, step: steps.find((s) => s.stage === currentStage)! });
}

/** A fixture order's built-in step of this kind (its steps made first if it has none). */
export async function stepIdFor(prisma: PrismaClient, orderId: string, stage: BespokeStage): Promise<string> {
  await ensureSteps(prisma, orderId);
  const id = await builtInStepId(prisma, orderId, stage);
  if (!id) throw new Error(`no ${stage} step on ${orderId}`);
  return id;
}
