/**
 * Stage-gate evaluator + auth tests (no DB except optional PATCH/relock helpers).
 *
 *   pnpm test:stage-gate
 */
import { BespokeStage, Role, StageApprovalStatus } from "@prisma/client";
import {
  evaluateRevert,
  evaluateStageGate,
  type StageGateSnapshot,
} from "../src/lib/atelier/can-complete-stage";
import { getStageRequirement } from "../src/lib/atelier/stage-requirements";
import {
  BESPOKE_ADMIN_ROLES,
  BESPOKE_MANAGER_ROLES,
  BESPOKE_STAFF_ROLES,
  sessionHasRole,
} from "../src/lib/bespoke-roles";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function snapshot(partial: Partial<StageGateSnapshot> & { currentStage: BespokeStage }): StageGateSnapshot {
  const stage = partial.currentStage;
  return {
    orderId: "ord_1",
    orderRef: "ORD-1001",
    productionUnlockedAt: null,
    completedStages: [],
    notes: null,
    mediaCount: 0,
    latestApprovalStatus: null,
    balance: 0,
    requirement: getStageRequirement(stage),
    ...partial,
  };
}

const staff = { id: "u1", role: Role.STAFF };
const admin = { id: "u2", role: Role.ADMIN };

const PRIOR_TO_DESIGN = [
  BespokeStage.CONSULTATION_BOOKING,
  BespokeStage.CONSULTATION_SESSION,
  BespokeStage.INVOICE_ISSUANCE,
  BespokeStage.PAYMENT_CONFIRMATION,
  BespokeStage.SKETCHING_CONCEPT,
  BespokeStage.FABRIC_SOURCING,
];

function main() {
  // Fresh order (empty completions) cannot jump to FIRST_FITTING (stage 9).
  const jump = evaluateStageGate({
    snapshot: snapshot({
      currentStage: BespokeStage.FIRST_FITTING,
      notes: "trying to skip",
      productionUnlockedAt: new Date(),
    }),
    stage: BespokeStage.FIRST_FITTING,
    actor: staff,
  });
  assert(!jump.ok, "fresh order must not complete stage 9");
  assert(
    jump.failures.some((f) => f.code === "PREVIOUS_STAGE_INCOMPLETE"),
    `expected PREVIOUS_STAGE_INCOMPLETE, got ${jump.failures.map((f) => f.code).join(",")}`,
  );

  // Empty history: only CONSULTATION_BOOKING is legal (no predecessor).
  const stage1 = evaluateStageGate({
    snapshot: snapshot({
      currentStage: BespokeStage.CONSULTATION_BOOKING,
      notes: "booked",
    }),
    stage: BespokeStage.CONSULTATION_BOOKING,
    actor: staff,
  });
  assert(stage1.ok, `stage 1 with notes should pass: ${stage1.failures.map((f) => f.message).join("; ")}`);

  // Stage 5 refuses without media.
  const sketch = evaluateStageGate({
    snapshot: snapshot({
      currentStage: BespokeStage.SKETCHING_CONCEPT,
      completedStages: [
        BespokeStage.CONSULTATION_BOOKING,
        BespokeStage.CONSULTATION_SESSION,
        BespokeStage.INVOICE_ISSUANCE,
        BespokeStage.PAYMENT_CONFIRMATION,
      ],
      notes: "concept notes",
      mediaCount: 0,
      productionUnlockedAt: new Date(),
    }),
    stage: BespokeStage.SKETCHING_CONCEPT,
    actor: staff,
  });
  assert(!sketch.ok, "stage 5 without media must fail");
  assert(
    sketch.failures.some((f) => f.code === "MEDIA_REQUIRED"),
    `expected MEDIA_REQUIRED, got ${sketch.failures.map((f) => f.code).join(",")}`,
  );

  // Stage 13 refuses with a balance.
  const delivery = evaluateStageGate({
    snapshot: snapshot({
      currentStage: BespokeStage.DELIVERY,
      completedStages: [
        ...PRIOR_TO_DESIGN,
        BespokeStage.DESIGN_APPROVAL,
        BespokeStage.TAILORING,
        BespokeStage.FIRST_FITTING,
        BespokeStage.ALTERATIONS,
        BespokeStage.BEADING_FINISHING,
        BespokeStage.FINAL_FITTING,
      ],
      notes: "ready for collection",
      mediaCount: 2,
      productionUnlockedAt: new Date(),
      balance: 450_000,
      latestApprovalStatus: StageApprovalStatus.APPROVED,
    }),
    stage: BespokeStage.DELIVERY,
    actor: staff,
  });
  assert(!delivery.ok, "delivery with balance must fail");
  assert(
    delivery.failures.some((f) => f.code === "OUTSTANDING_BALANCE"),
    `expected OUTSTANDING_BALANCE, got ${delivery.failures.map((f) => f.code).join(",")}`,
  );
  assert(
    delivery.failures.some((f) => f.message.includes("450,000") || f.message.includes("450000")),
    `balance message should be specific, got: ${delivery.failures.map((f) => f.message).join("; ")}`,
  );

  // Returns all failures, not just the first.
  const multi = evaluateStageGate({
    snapshot: snapshot({
      currentStage: BespokeStage.DESIGN_APPROVAL,
      completedStages: [],
      notes: null,
      mediaCount: 0,
      productionUnlockedAt: null,
    }),
    stage: BespokeStage.DESIGN_APPROVAL,
    actor: staff,
  });
  const codes = new Set(multi.failures.map((f) => f.code));
  assert(codes.has("PREVIOUS_STAGE_INCOMPLETE"), "multi: previous");
  assert(codes.has("NOTES_REQUIRED"), "multi: notes");
  assert(codes.has("MEDIA_REQUIRED"), "multi: media");
  assert(codes.has("DEPOSIT_NOT_SATISFIED"), "multi: deposit");
  assert(codes.has("CLIENT_APPROVAL_PENDING"), "multi: approval");
  assert(multi.failures.length >= 5, `multi: expected ≥5 failures, got ${multi.failures.length}`);

  // Stage 7: no approval / CHANGES_REQUESTED / APPROVED / SUPERSEDED (treated as no approval).
  const designBase = {
    currentStage: BespokeStage.DESIGN_APPROVAL,
    completedStages: PRIOR_TO_DESIGN,
    notes: "design notes",
    mediaCount: 2,
    productionUnlockedAt: new Date(),
  } as const;

  const noApproval = evaluateStageGate({
    snapshot: snapshot({ ...designBase, latestApprovalStatus: null }),
    stage: BespokeStage.DESIGN_APPROVAL,
    actor: staff,
  });
  assert(!noApproval.ok, "stage 7 with no approval must fail");
  assert(noApproval.failures.some((f) => f.code === "CLIENT_APPROVAL_PENDING"), "stage 7 none → PENDING code");

  const changes = evaluateStageGate({
    snapshot: snapshot({ ...designBase, latestApprovalStatus: StageApprovalStatus.CHANGES_REQUESTED }),
    stage: BespokeStage.DESIGN_APPROVAL,
    actor: staff,
  });
  assert(!changes.ok, "stage 7 with CHANGES_REQUESTED must fail");
  assert(changes.failures.some((f) => f.code === "CLIENT_APPROVAL_PENDING"), "stage 7 changes → PENDING code");
  assert(
    changes.failures.some((f) => f.message.toLowerCase().includes("requested changes")),
    `stage 7 changes message should mention requested changes, got: ${changes.failures.map((f) => f.message).join("; ")}`,
  );

  const approved = evaluateStageGate({
    snapshot: snapshot({ ...designBase, latestApprovalStatus: StageApprovalStatus.APPROVED }),
    stage: BespokeStage.DESIGN_APPROVAL,
    actor: staff,
  });
  assert(approved.ok, `stage 7 with APPROVED should pass: ${approved.failures.map((f) => f.message).join("; ")}`);

  const superseded = evaluateStageGate({
    snapshot: snapshot({ ...designBase, latestApprovalStatus: null }),
    stage: BespokeStage.DESIGN_APPROVAL,
    actor: staff,
  });
  assert(!superseded.ok, "after revert, superseded approval must not satisfy the gate");
  assert(superseded.failures.some((f) => f.code === "CLIENT_APPROVAL_PENDING"), "superseded → must re-request");

  // Deposit relock: productionUnlockedAt null blocks further production even if prior stages completed.
  const relocked = evaluateStageGate({
    snapshot: snapshot({
      currentStage: BespokeStage.TAILORING,
      completedStages: [...PRIOR_TO_DESIGN, BespokeStage.DESIGN_APPROVAL],
      notes: "cutting",
      mediaCount: 1,
      productionUnlockedAt: null,
    }),
    stage: BespokeStage.TAILORING,
    actor: staff,
  });
  assert(!relocked.ok, "relocked deposit must block further production");
  assert(relocked.failures.some((f) => f.code === "DEPOSIT_NOT_SATISFIED"), "relock → DEPOSIT_NOT_SATISFIED");

  // Staff cannot revert; admin can with a reason.
  const staffRevert = evaluateRevert({
    currentStage: BespokeStage.TAILORING,
    targetStage: BespokeStage.DESIGN_APPROVAL,
    actor: staff,
    reason: "client changed mind",
  });
  assert(!staffRevert.ok, "staff must not revert");
  assert(staffRevert.failures.some((f) => f.code === "REVERT_FORBIDDEN"), "staff revert code");

  const adminNoReason = evaluateRevert({
    currentStage: BespokeStage.TAILORING,
    targetStage: BespokeStage.DESIGN_APPROVAL,
    actor: admin,
    reason: "",
  });
  assert(!adminNoReason.ok, "admin revert needs reason");
  assert(adminNoReason.failures.some((f) => f.code === "REVERT_REASON_REQUIRED"), "reason code");

  const adminOk = evaluateRevert({
    currentStage: BespokeStage.TAILORING,
    targetStage: BespokeStage.DESIGN_APPROVAL,
    actor: admin,
    reason: "wrong fabric chosen",
  });
  assert(adminOk.ok, `admin revert should pass: ${adminOk.failures.map((f) => f.message).join("; ")}`);

  // Role split: STAFF can floor routes, cannot manager/admin routes.
  assert(sessionHasRole("STAFF", null, BESPOKE_STAFF_ROLES), "STAFF on staff roles");
  assert(!sessionHasRole("STAFF", null, BESPOKE_MANAGER_ROLES), "STAFF not on manager roles");
  assert(!sessionHasRole("STAFF", null, BESPOKE_ADMIN_ROLES), "STAFF not on admin roles");
  assert(sessionHasRole("ADMIN", null, BESPOKE_ADMIN_ROLES), "ADMIN on admin roles");
  assert(sessionHasRole("STAFF_ADMIN", null, BESPOKE_MANAGER_ROLES), "STAFF_ADMIN on manager roles");
  assert(!sessionHasRole("STAFF_ADMIN", null, BESPOKE_ADMIN_ROLES), "STAFF_ADMIN not on admin roles");

  console.log("test-stage-gate: all assertions passed");
}

main();
