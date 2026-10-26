/**
 * One commission's own steps (OrderStage rows): pure rules, no database.
 *
 * Every order starts with the thirteen built-in steps in STAGE_ORDER. The house
 * (holders of `bespoke.pipeline`) can then move a step, skip it, add a custom
 * step and start a step alongside the ones already running. What it cannot do
 * is switch off the house rules, which live here:
 *
 *  - The four intake steps stay first, in order, and run one after another.
 *  - Delivery stays last, and starts only once every other step is done.
 *  - Design Approval can never be skipped or removed, and nothing is cut before
 *    it: Tailoring, the fittings, Alterations and Beading — and any custom step
 *    placed after it — wait until it is done.
 *  - A step started alongside others (`canStartNow`) needs the deposit confirmed.
 *    The usual flow, one step after another, does not: as before, a craft step
 *    can be in progress while the deposit is awaited, and completing it waits.
 */
import { BespokeStage, OrderStageStatus, Role } from "@prisma/client";
import { STAGE_DESCRIPTIONS, STAGE_ORDER, STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { INTAKE_STAGES } from "@/lib/atelier/intake-stages";
import { getStageRequirement, type StageRequirement } from "@/lib/atelier/stage-requirements";

export type PipelineStep = {
  id: string;
  position: number;
  stage: BespokeStage;
  label: string | null;
  clientDescription: string | null;
  status: OrderStageStatus;
  requiresNotes: boolean;
  minMediaCount: number;
  requiresClientApproval: boolean;
};

export type PipelineFailureCode =
  | "STEP_NOT_FOUND"
  | "STEP_NOT_ACTIVE"
  | "STEP_NOT_PENDING"
  | "STEP_LOCKED"
  | "STEP_DONE"
  | "INTAKE_INCOMPLETE"
  | "DESIGN_APPROVAL_FIRST"
  | "DELIVERY_LAST"
  | "DEPOSIT_NOT_SATISFIED"
  | "INVALID_ORDER"
  | "LABEL_REQUIRED"
  | "REASON_REQUIRED";

export type PipelineFailure = { code: PipelineFailureCode; message: string };

export const INTAKE_STAGE_SET: ReadonlySet<BespokeStage> = new Set<BespokeStage>(INTAKE_STAGES);

/** Steps that wait for Design Approval: nothing is cut until the client approves. */
export const CUT_STAGES: ReadonlySet<BespokeStage> = new Set<BespokeStage>([
  BespokeStage.TAILORING,
  BespokeStage.FIRST_FITTING,
  BespokeStage.ALTERATIONS,
  BespokeStage.BEADING_FINISHING,
  BespokeStage.FINAL_FITTING,
]);

/** Steps that can never be skipped or removed. */
export const UNSKIPPABLE_STAGES: ReadonlySet<BespokeStage> = new Set<BespokeStage>([
  ...INTAKE_STAGES,
  BespokeStage.DESIGN_APPROVAL,
  BespokeStage.DELIVERY,
]);

/** Steps whose place is fixed: the intake run at the start, Delivery at the end. */
export const FIXED_PLACE_STAGES: ReadonlySet<BespokeStage> = new Set<BespokeStage>([
  ...INTAKE_STAGES,
  BespokeStage.DELIVERY,
]);

export const CUSTOM_LABEL_MAX = 80;

const ATELIER_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.STAFF_ADMIN,
  Role.BESPOKE_MANAGER,
  Role.STAFF,
];

export function isCustomStep(step: Pick<PipelineStep, "stage">): boolean {
  return step.stage === BespokeStage.CUSTOM;
}

export function stepLabel(step: Pick<PipelineStep, "stage" | "label">): string {
  return step.label?.trim() || STAGE_SHORT_LABELS[step.stage];
}

export function stepDescription(step: Pick<PipelineStep, "stage" | "clientDescription">): string {
  return step.clientDescription?.trim() || STAGE_DESCRIPTIONS[step.stage];
}

/** What completing this step needs. Built-in steps keep STAGE_REQUIREMENTS. */
export function stepRequirement(
  step: Pick<PipelineStep, "stage" | "requiresNotes" | "minMediaCount" | "requiresClientApproval">,
): StageRequirement {
  if (!isCustomStep(step)) return getStageRequirement(step.stage);
  const min = Math.max(0, Math.floor(step.minMediaCount));
  return {
    requiresNotes: step.requiresNotes,
    requiresMedia: min > 0,
    minMediaCount: min,
    requiresClientApproval: step.requiresClientApproval,
    // Custom steps sit among the craft steps, which all need the deposit.
    requiresDepositSatisfied: true,
    requiresZeroBalance: false,
    requiredRoles: ATELIER_ROLES,
  };
}

export function sortSteps<T extends Pick<PipelineStep, "position">>(steps: readonly T[]): T[] {
  return [...steps].sort((a, b) => a.position - b.position);
}

export type NumberedStep<T> = T & { number: number };

/** The steps the order really has (skipped ones left out), numbered 1..N. */
export function visibleSteps<T extends Pick<PipelineStep, "position" | "status">>(
  steps: readonly T[],
): NumberedStep<T>[] {
  return sortSteps(steps)
    .filter((s) => s.status !== OrderStageStatus.SKIPPED)
    .map((s, i) => ({ ...s, number: i + 1 }));
}

/** What her own pages show of a step: its name and words for her, never the house's requirements. */
export type ClientStep = {
  id: string;
  stage: BespokeStage;
  number: number;
  label: string;
  description: string;
  status: "PENDING" | "ACTIVE" | "DONE";
};

/** The columns clientSteps reads (a Prisma select; kept here so client pages ask for no more). */
export const CLIENT_STEP_SELECT = {
  id: true,
  position: true,
  stage: true,
  label: true,
  clientDescription: true,
  status: true,
} as const;

/** Her order's real steps: in their order, skipped ones left out, custom ones by their name. */
export function clientSteps(
  steps: readonly Pick<PipelineStep, "id" | "position" | "stage" | "label" | "clientDescription" | "status">[],
): ClientStep[] {
  return visibleSteps(steps).map((s) => ({
    id: s.id,
    stage: s.stage,
    number: s.number,
    label: stepLabel(s),
    description: stepDescription(s),
    status: s.status as ClientStep["status"],
  }));
}

/** "Step 4 of 12": steps done and steps in all, skipped ones not counted. */
export function stepProgress(steps: readonly Pick<PipelineStep, "status" | "position">[]): {
  done: number;
  total: number;
} {
  const visible = visibleSteps(steps);
  return {
    done: visible.filter((s) => s.status === OrderStageStatus.DONE).length,
    total: visible.length,
  };
}

export function activeSteps<T extends Pick<PipelineStep, "status" | "position">>(steps: readonly T[]): T[] {
  return sortSteps(steps).filter((s) => s.status === OrderStageStatus.ACTIVE);
}

/**
 * The lead step, kept on BespokeOrder.currentStage for the lists, counts and
 * links that need one stage: the first active step, else the first waiting one,
 * else DELIVERY (everything done).
 */
export function leadStep<T extends Pick<PipelineStep, "status" | "position" | "stage">>(
  steps: readonly T[],
): T | null {
  const sorted = sortSteps(steps);
  return (
    sorted.find((s) => s.status === OrderStageStatus.ACTIVE) ??
    sorted.find((s) => s.status === OrderStageStatus.PENDING) ??
    null
  );
}

export function leadStage(steps: readonly Pick<PipelineStep, "status" | "position" | "stage">[]): BespokeStage {
  return leadStep(steps)?.stage ?? BespokeStage.DELIVERY;
}

export function allStepsDone(steps: readonly Pick<PipelineStep, "status">[]): boolean {
  return steps.every((s) => s.status === OrderStageStatus.DONE || s.status === OrderStageStatus.SKIPPED);
}

function isSettled(step: Pick<PipelineStep, "status">): boolean {
  return step.status === OrderStageStatus.DONE || step.status === OrderStageStatus.SKIPPED;
}

function designApprovalOf<T extends Pick<PipelineStep, "stage">>(steps: readonly T[]): T | undefined {
  return steps.find((s) => s.stage === BespokeStage.DESIGN_APPROVAL);
}

/** Does this step wait for Design Approval? Cut steps always; custom steps placed after it. */
export function waitsForDesignApproval(
  step: Pick<PipelineStep, "stage" | "position">,
  steps: readonly Pick<PipelineStep, "stage" | "position">[],
): boolean {
  if (CUT_STAGES.has(step.stage)) return true;
  if (!isCustomStep(step)) return false;
  const da = designApprovalOf(steps);
  return Boolean(da && step.position > da.position);
}

/**
 * The house rules for a step to become active. `alongside` = started next to
 * steps already running ("Start now"), which also needs the deposit.
 */
export function startBlockers(params: {
  step: PipelineStep;
  steps: readonly PipelineStep[];
  productionUnlocked: boolean;
  alongside: boolean;
}): PipelineFailure[] {
  const { step, steps } = params;
  const failures: PipelineFailure[] = [];
  const label = stepLabel(step);
  const sorted = sortSteps(steps);

  if (step.status !== OrderStageStatus.PENDING) {
    failures.push({ code: "STEP_NOT_PENDING", message: `${label} is not waiting to start.` });
    return failures;
  }

  if (INTAKE_STAGE_SET.has(step.stage)) {
    const earlier = sorted.filter((s) => INTAKE_STAGE_SET.has(s.stage) && s.position < step.position);
    const open = earlier.find((s) => !isSettled(s));
    if (open) {
      failures.push({
        code: "INTAKE_INCOMPLETE",
        message: `${stepLabel(open)} must be done before ${label}.`,
      });
    }
  } else {
    const openIntake = sorted.find((s) => INTAKE_STAGE_SET.has(s.stage) && !isSettled(s));
    if (openIntake) {
      failures.push({
        code: "INTAKE_INCOMPLETE",
        message: `${stepLabel(openIntake)} must be done before the craft steps begin.`,
      });
    }
  }

  if (waitsForDesignApproval(step, steps)) {
    const da = designApprovalOf(steps);
    if (da && da.status !== OrderStageStatus.DONE) {
      failures.push({
        code: "DESIGN_APPROVAL_FIRST",
        message: `Nothing is cut before the client approves the design: ${label} waits for Design Approval.`,
      });
    }
  }

  if (step.stage === BespokeStage.DELIVERY) {
    const open = sorted.filter((s) => s.id !== step.id && !isSettled(s));
    if (open.length) {
      failures.push({
        code: "DELIVERY_LAST",
        message: `Delivery comes last: ${open.map(stepLabel).join(", ")} still to finish.`,
      });
    }
  }

  if (params.alongside && !INTAKE_STAGE_SET.has(step.stage) && !params.productionUnlocked) {
    failures.push({
      code: "DEPOSIT_NOT_SATISFIED",
      message: "Steps can run side by side once the deposit is confirmed.",
    });
  }

  return failures;
}

export function canStartNow(params: {
  step: PipelineStep;
  steps: readonly PipelineStep[];
  productionUnlocked: boolean;
}): { ok: boolean; failures: PipelineFailure[] } {
  const failures = startBlockers({ ...params, alongside: true });
  return { ok: failures.length === 0, failures };
}

/**
 * Which steps become active once `completedId` is done (its status already DONE
 * in `steps`). While other steps are still running nothing new starts: they
 * finish first. Otherwise the first waiting step, by position, that the house
 * rules let start.
 */
export function stepsToActivate(steps: readonly PipelineStep[], productionUnlocked: boolean): string[] {
  if (activeSteps(steps).length) return [];
  for (const step of sortSteps(steps)) {
    if (step.status !== OrderStageStatus.PENDING) continue;
    const blockers = startBlockers({ step, steps, productionUnlocked, alongside: false });
    return blockers.length ? [] : [step.id];
  }
  return [];
}

/** Rules every ordering of an order's steps must keep. */
export function orderBlockers(steps: readonly Pick<PipelineStep, "id" | "stage" | "position" | "label">[]): PipelineFailure[] {
  const sorted = sortSteps(steps);
  const failures: PipelineFailure[] = [];
  const intakeOrder = STAGE_ORDER.filter((s) => INTAKE_STAGE_SET.has(s));
  const head = sorted.slice(0, intakeOrder.length).map((s) => s.stage);
  if (head.join() !== intakeOrder.join()) {
    failures.push({
      code: "STEP_LOCKED",
      message: "The four intake steps stay first, in their order.",
    });
  }
  const last = sorted[sorted.length - 1];
  if (!last || last.stage !== BespokeStage.DELIVERY) {
    failures.push({ code: "DELIVERY_LAST", message: "Delivery stays the last step." });
  }
  const da = designApprovalOf(sorted);
  if (da) {
    const early = sorted.find((s) => CUT_STAGES.has(s.stage) && s.position < da.position);
    if (early) {
      failures.push({
        code: "DESIGN_APPROVAL_FIRST",
        message: `${stepLabel(early)} must come after Design Approval: nothing is cut before the client approves.`,
      });
    }
  }
  return failures;
}

/** Give a list of steps positions 1..N in the order given. */
export function renumber<T extends { position: number }>(ordered: readonly T[]): T[] {
  return ordered.map((s, i) => ({ ...s, position: i + 1 }));
}

/** Move one step up or down one place. Returns the new ordering or why not. */
export function moveStep<T extends PipelineStep>(
  steps: readonly T[],
  stepId: string,
  direction: "up" | "down",
): { ok: true; steps: T[] } | { ok: false; failures: PipelineFailure[] } {
  const sorted = sortSteps(steps);
  const idx = sorted.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, failures: [{ code: "STEP_NOT_FOUND", message: "Step not found." }] };
  const step = sorted[idx]!;
  if (FIXED_PLACE_STAGES.has(step.stage)) {
    return { ok: false, failures: [{ code: "STEP_LOCKED", message: `${stepLabel(step)} cannot be moved.` }] };
  }
  if (step.status === OrderStageStatus.DONE) {
    return { ok: false, failures: [{ code: "STEP_DONE", message: `${stepLabel(step)} is done and stays where it is.` }] };
  }
  const to = direction === "up" ? idx - 1 : idx + 1;
  if (to < 0 || to >= sorted.length) {
    return { ok: false, failures: [{ code: "INVALID_ORDER", message: "The step is already at the end." }] };
  }
  const next = [...sorted];
  next[idx] = sorted[to]!;
  next[to] = step;
  const renumbered = renumber(next);
  const failures = orderBlockers(renumbered);
  return failures.length ? { ok: false, failures } : { ok: true, steps: renumbered };
}

export function skipBlockers(step: PipelineStep, reason: string | null | undefined): PipelineFailure[] {
  const failures: PipelineFailure[] = [];
  if (UNSKIPPABLE_STAGES.has(step.stage)) {
    failures.push({ code: "STEP_LOCKED", message: `${stepLabel(step)} cannot be skipped.` });
  }
  if (step.status === OrderStageStatus.DONE) {
    failures.push({ code: "STEP_DONE", message: `${stepLabel(step)} is already done.` });
  }
  if (step.status === OrderStageStatus.SKIPPED) {
    failures.push({ code: "STEP_NOT_PENDING", message: `${stepLabel(step)} is already skipped.` });
  }
  if (!reason?.trim()) {
    failures.push({ code: "REASON_REQUIRED", message: "Say why this step is skipped." });
  }
  return failures;
}

/**
 * "Mark done": work finished before it was recorded here. Delivery is not marked
 * done this way: completing it hands the gown over and tells her, so it goes
 * through the stage panel.
 */
export function markDoneBlockers(step: PipelineStep): PipelineFailure[] {
  if (step.status === OrderStageStatus.DONE) {
    return [{ code: "STEP_DONE", message: `${stepLabel(step)} is already done.` }];
  }
  if (step.status === OrderStageStatus.SKIPPED) {
    return [{ code: "STEP_NOT_PENDING", message: `${stepLabel(step)} is skipped: bring it back first.` }];
  }
  if (step.stage === BespokeStage.DELIVERY) {
    return [
      {
        code: "STEP_LOCKED",
        message: "Complete Delivery from the stage panel: it records the handover and tells her.",
      },
    ];
  }
  return [];
}

/** The steps "Mark done" writes: this one, and with `withEarlier` every open step before it (skipped ones left out). */
export function stepsToMarkDone<T extends PipelineStep>(steps: readonly T[], stepId: string, withEarlier: boolean): T[] {
  const sorted = sortSteps(steps);
  const step = sorted.find((s) => s.id === stepId);
  if (!step) return [];
  const open = (s: T) => s.status === OrderStageStatus.PENDING || s.status === OrderStageStatus.ACTIVE;
  const earlier = withEarlier ? sorted.filter((s) => s.position < step.position && open(s)) : [];
  return [...earlier, step];
}

/** Where a new custom step may go: after `afterStepId`, never before the intake run ends or after Delivery. */
export function insertCustomStep<T extends Pick<PipelineStep, "id" | "stage" | "position" | "label">>(
  steps: readonly T[],
  afterStepId: string,
  newStep: T,
): { ok: true; steps: T[] } | { ok: false; failures: PipelineFailure[] } {
  if (!newStep.label?.trim()) {
    return { ok: false, failures: [{ code: "LABEL_REQUIRED", message: "Give the step a name." }] };
  }
  if (newStep.label.trim().length > CUSTOM_LABEL_MAX) {
    return {
      ok: false,
      failures: [{ code: "LABEL_REQUIRED", message: `Keep the name under ${CUSTOM_LABEL_MAX} characters.` }],
    };
  }
  const sorted = sortSteps(steps);
  const idx = sorted.findIndex((s) => s.id === afterStepId);
  if (idx < 0) return { ok: false, failures: [{ code: "STEP_NOT_FOUND", message: "Step not found." }] };
  const next = [...sorted.slice(0, idx + 1), newStep, ...sorted.slice(idx + 1)];
  const renumbered = renumber(next);
  const failures = orderBlockers(renumbered);
  return failures.length ? { ok: false, failures } : { ok: true, steps: renumbered };
}

/** The thirteen built-in steps for a new order, the first `doneThrough` of them done. */
export function defaultSteps(params: { activeStage: BespokeStage; doneStages?: Iterable<BespokeStage> }): {
  position: number;
  stage: BespokeStage;
  status: OrderStageStatus;
}[] {
  const done = new Set(params.doneStages ?? []);
  const activeIdx = STAGE_ORDER.indexOf(params.activeStage);
  return STAGE_ORDER.map((stage, i) => ({
    position: i + 1,
    stage,
    status: done.has(stage) || i < activeIdx
      ? OrderStageStatus.DONE
      : i === activeIdx
        ? OrderStageStatus.ACTIVE
        : OrderStageStatus.PENDING,
  }));
}
