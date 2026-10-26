/**
 * Flexible atelier pipeline: one order's own steps (pure rules, no database).
 *
 *   pnpm tsx --tsconfig tsconfig.scripts.json scripts/test-pipeline-flex.ts
 */
import { BespokeStage, OrderStageStatus } from "@prisma/client";
import { STAGE_ORDER } from "../src/lib/bespoke-stages";
import {
  canStartNow,
  defaultSteps,
  insertCustomStep,
  leadStage,
  markDoneBlockers,
  moveStep,
  orderBlockers,
  skipBlockers,
  startBlockers,
  stepProgress,
  stepRequirement,
  stepsToActivate,
  stepsToMarkDone,
  visibleSteps,
  type PipelineStep,
} from "../src/lib/atelier/pipeline";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

/** The thirteen built-in steps, `active` under way (everything before it done). */
function order(active: BespokeStage): PipelineStep[] {
  return defaultSteps({ activeStage: active }).map((r) => ({
    ...r,
    id: r.stage,
    label: null,
    clientDescription: null,
    requiresNotes: true,
    minMediaCount: 0,
    requiresClientApproval: false,
  }));
}

function custom(id: string, label: string, extra: Partial<PipelineStep> = {}): PipelineStep {
  return {
    id,
    position: 0,
    stage: BespokeStage.CUSTOM,
    label,
    clientDescription: null,
    status: OrderStageStatus.PENDING,
    requiresNotes: true,
    minMediaCount: 0,
    requiresClientApproval: false,
    ...extra,
  };
}

function set(steps: PipelineStep[], id: string, status: OrderStageStatus): PipelineStep[] {
  return steps.map((s) => (s.id === id ? { ...s, status } : s));
}

function ids(steps: { id: string }[]): string[] {
  return steps.map((s) => s.id);
}

function codes(failures: { code: string }[]): string {
  return failures.map((f) => f.code).join(",");
}

function main() {
  // A new order: the thirteen steps, in STAGE_ORDER, numbered 1..13.
  const fresh = order(BespokeStage.SKETCHING_CONCEPT);
  assert(ids(visibleSteps(fresh)).join() === STAGE_ORDER.join(), "default steps follow STAGE_ORDER");
  assert(orderBlockers(fresh).length === 0, "the default order keeps every rule");
  assert(leadStage(fresh) === BespokeStage.SKETCHING_CONCEPT, "lead is the active step");
  assert(stepProgress(fresh).done === 4 && stepProgress(fresh).total === 13, "4 of 13 done after intake");

  // Move: Fabric Sourcing before Sketching (step 6 before step 5).
  const moved = moveStep(fresh, BespokeStage.FABRIC_SOURCING, "up");
  assert(moved.ok, "fabric can move above sketching");
  assert(
    ids(visibleSteps(moved.steps)).slice(4, 6).join() === "FABRIC_SOURCING,SKETCHING_CONCEPT",
    "fabric now comes first",
  );

  // Locked places: intake and Delivery cannot move.
  const intakeMove = moveStep(fresh, BespokeStage.INVOICE_ISSUANCE, "down");
  assert(!intakeMove.ok && codes(intakeMove.failures).includes("STEP_LOCKED"), "intake steps do not move");
  const deliveryMove = moveStep(fresh, BespokeStage.DELIVERY, "up");
  assert(!deliveryMove.ok && codes(deliveryMove.failures).includes("STEP_LOCKED"), "delivery does not move");
  // Sketching cannot climb into the intake run.
  const intoIntake = moveStep(fresh, BespokeStage.SKETCHING_CONCEPT, "up");
  assert(!intoIntake.ok && codes(intoIntake.failures).includes("STEP_LOCKED"), "craft steps stay after intake");
  // Tailoring cannot move above Design Approval: nothing is cut before the client approves.
  const cutEarly = moveStep(fresh, BespokeStage.TAILORING, "up");
  assert(
    !cutEarly.ok && codes(cutEarly.failures).includes("DESIGN_APPROVAL_FIRST"),
    `tailoring stays after design approval, got ${!cutEarly.ok && codes(cutEarly.failures)}`,
  );
  // A done step stays where it is.
  const doneMove = moveStep(set(fresh, BespokeStage.SKETCHING_CONCEPT, OrderStageStatus.DONE), BespokeStage.SKETCHING_CONCEPT, "down");
  assert(!doneMove.ok && codes(doneMove.failures).includes("STEP_DONE"), "done steps do not move");

  // Skip: Beading can be skipped with a reason; the locked ones cannot.
  const beading = fresh.find((s) => s.id === BespokeStage.BEADING_FINISHING)!;
  assert(skipBlockers(beading, "No beading on this dress").length === 0, "beading can be skipped");
  assert(codes(skipBlockers(beading, "  ")).includes("REASON_REQUIRED"), "a skip needs a reason");
  for (const locked of [BespokeStage.DESIGN_APPROVAL, BespokeStage.DELIVERY, BespokeStage.PAYMENT_CONFIRMATION]) {
    const step = fresh.find((s) => s.id === locked)!;
    assert(codes(skipBlockers(step, "x")).includes("STEP_LOCKED"), `${locked} cannot be skipped`);
  }
  const skipped = set(fresh, BespokeStage.BEADING_FINISHING, OrderStageStatus.SKIPPED);
  assert(visibleSteps(skipped).length === 12, "a skipped step is not shown");
  assert(
    visibleSteps(skipped).find((s) => s.id === BespokeStage.FINAL_FITTING)?.number === 11,
    "numbering closes over the skipped step",
  );
  assert(stepProgress(skipped).total === 12, "progress counts 12 steps");

  // Add: a second fitting after Alterations.
  const added = insertCustomStep(fresh, BespokeStage.ALTERATIONS, custom("c1", "Second fitting"));
  assert(added.ok, "a custom step can be added");
  const afterAlterations = visibleSteps(added.steps).map((s) => s.id);
  assert(
    afterAlterations[afterAlterations.indexOf(BespokeStage.ALTERATIONS) + 1] === "c1",
    "the custom step sits after Alterations",
  );
  assert(visibleSteps(added.steps).length === 14, "14 steps now");
  const unnamed = insertCustomStep(fresh, BespokeStage.ALTERATIONS, custom("c2", "  "));
  assert(!unnamed.ok && codes(unnamed.failures).includes("LABEL_REQUIRED"), "a custom step needs a name");
  const afterDelivery = insertCustomStep(fresh, BespokeStage.DELIVERY, custom("c3", "Thank-you call"));
  assert(!afterDelivery.ok && codes(afterDelivery.failures).includes("DELIVERY_LAST"), "nothing goes after delivery");
  const intoIntakeAdd = insertCustomStep(fresh, BespokeStage.CONSULTATION_BOOKING, custom("c4", "Mood board"));
  assert(!intoIntakeAdd.ok && codes(intoIntakeAdd.failures).includes("STEP_LOCKED"), "nothing goes inside the intake run");

  // A custom step's requirements come from its row; it always needs the deposit.
  const req = stepRequirement(custom("c5", "Veil", { minMediaCount: 2, requiresClientApproval: true, requiresNotes: false }));
  assert(req.requiresMedia && req.minMediaCount === 2, "custom media requirement");
  assert(req.requiresClientApproval && !req.requiresNotes, "custom approval and notes");
  assert(req.requiresDepositSatisfied, "custom steps need the deposit");

  // Start now: Fabric alongside Sketching, once the deposit is in.
  const fabric = fresh.find((s) => s.id === BespokeStage.FABRIC_SOURCING)!;
  const noDeposit = canStartNow({ step: fabric, steps: fresh, productionUnlocked: false });
  assert(!noDeposit.ok && codes(noDeposit.failures).includes("DEPOSIT_NOT_SATISFIED"), "side by side needs the deposit");
  assert(canStartNow({ step: fabric, steps: fresh, productionUnlocked: true }).ok, "fabric can run beside sketching");
  // Tailoring cannot start before Design Approval, deposit or not.
  const tailoring = fresh.find((s) => s.id === BespokeStage.TAILORING)!;
  const cutNow = canStartNow({ step: tailoring, steps: fresh, productionUnlocked: true });
  assert(!cutNow.ok && codes(cutNow.failures).includes("DESIGN_APPROVAL_FIRST"), "tailoring waits for design approval");
  // A custom step placed after Design Approval waits for it too; one before it does not.
  const late = insertCustomStep(fresh, BespokeStage.TAILORING, custom("late", "Corset build"));
  assert(late.ok, "custom step after tailoring");
  const lateStep = late.steps.find((s) => s.id === "late")!;
  assert(
    codes(canStartNow({ step: lateStep, steps: late.steps, productionUnlocked: true }).failures).includes("DESIGN_APPROVAL_FIRST"),
    "custom step after design approval waits for it",
  );
  const early = insertCustomStep(fresh, BespokeStage.SKETCHING_CONCEPT, custom("early", "Mood board"));
  assert(early.ok, "custom step after sketching");
  assert(
    canStartNow({ step: early.steps.find((s) => s.id === "early")!, steps: early.steps, productionUnlocked: true }).ok,
    "custom step before design approval can run alongside",
  );
  // Craft steps wait for the intake run.
  const atBooking = order(BespokeStage.CONSULTATION_BOOKING);
  assert(
    codes(canStartNow({ step: atBooking.find((s) => s.id === BespokeStage.SKETCHING_CONCEPT)!, steps: atBooking, productionUnlocked: true }).failures).includes("INTAKE_INCOMPLETE"),
    "craft steps wait for intake",
  );
  // Delivery waits for every other step.
  const atFinal = order(BespokeStage.FINAL_FITTING);
  assert(
    codes(canStartNow({ step: atFinal.find((s) => s.id === BespokeStage.DELIVERY)!, steps: atFinal, productionUnlocked: true }).failures).includes("DELIVERY_LAST"),
    "delivery waits for the rest",
  );

  // Parallel completion: Sketching and Fabric both running.
  let par = set(fresh, BespokeStage.FABRIC_SOURCING, OrderStageStatus.ACTIVE);
  par = set(par, BespokeStage.SKETCHING_CONCEPT, OrderStageStatus.DONE);
  assert(stepsToActivate(par, true).length === 0, "nothing new starts while fabric still runs");
  assert(leadStage(par) === BespokeStage.FABRIC_SOURCING, "lead moves to the step still running");
  par = set(par, BespokeStage.FABRIC_SOURCING, OrderStageStatus.DONE);
  assert(stepsToActivate(par, true).join() === BespokeStage.DESIGN_APPROVAL, "then design approval starts");

  // The normal flow does not need the deposit to start a step (only to complete it).
  const intakeDone = set(order(BespokeStage.PAYMENT_CONFIRMATION), BespokeStage.PAYMENT_CONFIRMATION, OrderStageStatus.DONE);
  assert(stepsToActivate(intakeDone, false).join() === BespokeStage.SKETCHING_CONCEPT, "sketching starts before the deposit");

  // Skipped steps are passed over; after the last one, Delivery.
  let toEnd = order(BespokeStage.BEADING_FINISHING);
  toEnd = set(toEnd, BespokeStage.BEADING_FINISHING, OrderStageStatus.DONE);
  toEnd = set(toEnd, BespokeStage.FINAL_FITTING, OrderStageStatus.SKIPPED);
  assert(stepsToActivate(toEnd, true).join() === BespokeStage.DELIVERY, "delivery follows once the rest are settled");

  // Reopening Design Approval: a running Tailoring goes back to waiting.
  let reopened = order(BespokeStage.TAILORING);
  reopened = set(reopened, BespokeStage.DESIGN_APPROVAL, OrderStageStatus.ACTIVE);
  const tailoringNow = reopened.find((s) => s.id === BespokeStage.TAILORING)!;
  assert(
    startBlockers({ step: { ...tailoringNow, status: OrderStageStatus.PENDING }, steps: reopened, productionUnlocked: true, alongside: false })
      .some((f) => f.code === "DESIGN_APPROVAL_FIRST"),
    "tailoring depends on the reopened design approval",
  );
  const fabricDone = reopened.find((s) => s.id === BespokeStage.FABRIC_SOURCING)!;
  assert(fabricDone.status === OrderStageStatus.DONE, "only the reopened step changes: fabric stays done");

  // Mark done: work finished before it was recorded here.
  const atBookingNow = order(BespokeStage.CONSULTATION_BOOKING);
  const tailoringAt = atBookingNow.find((s) => s.id === BespokeStage.TAILORING)!;
  assert(markDoneBlockers(tailoringAt).length === 0, "an open step can be marked done");
  assert(
    ids(stepsToMarkDone(atBookingNow, BespokeStage.TAILORING, false)).join() === BespokeStage.TAILORING,
    "just the one step",
  );
  assert(
    ids(stepsToMarkDone(atBookingNow, BespokeStage.TAILORING, true)).join() ===
      STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(BespokeStage.TAILORING) + 1).join(),
    "with the earlier open steps: booking through tailoring",
  );
  const withSkip = set(atBookingNow, BespokeStage.FABRIC_SOURCING, OrderStageStatus.SKIPPED);
  assert(
    !ids(stepsToMarkDone(withSkip, BespokeStage.TAILORING, true)).includes(BespokeStage.FABRIC_SOURCING),
    "a skipped step stays skipped",
  );
  assert(
    codes(markDoneBlockers(atBookingNow.find((s) => s.id === BespokeStage.DELIVERY)!)).includes("STEP_LOCKED"),
    "delivery goes through the stage panel",
  );
  assert(
    codes(markDoneBlockers(set(atBookingNow, BespokeStage.TAILORING, OrderStageStatus.DONE).find((s) => s.id === BespokeStage.TAILORING)!)).includes("STEP_DONE"),
    "a done step is not marked again",
  );

  // Everything done: the lead is Delivery.
  const allDone = order(BespokeStage.DELIVERY).map((s) => ({ ...s, status: OrderStageStatus.DONE }));
  assert(leadStage(allDone) === BespokeStage.DELIVERY, "lead is delivery once delivered");

  console.log("test-pipeline-flex: ok");
}

main();
