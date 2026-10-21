import {
  BespokeStage,
  OrderStageStatus,
  Role,
  StageApprovalStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatNgnKobo, balanceIsCleared } from "@/lib/money";
import { getOrderPaymentSummary, toNumber } from "@/lib/payments/ledger";
import { type StageRequirement } from "@/lib/atelier/stage-requirements";
import { buildStageChecklistFacts, presentStageChecklist } from "@/lib/atelier/stage-checklist";
import {
  startBlockers,
  stepLabel,
  stepRequirement,
  type PipelineStep,
} from "@/lib/atelier/pipeline";
import { loadSteps, PIPELINE_STEP_SELECT } from "@/lib/atelier/pipeline-db";

export type StageGateFailureCode =
  | "NOTES_REQUIRED"
  | "MEDIA_REQUIRED"
  | "CLIENT_APPROVAL_PENDING"
  | "OUTSTANDING_BALANCE"
  | "PREVIOUS_STAGE_INCOMPLETE"
  | "DEPOSIT_NOT_SATISFIED"
  | "FORBIDDEN_ROLE"
  | "WRONG_STAGE"
  | "REVERT_FORBIDDEN"
  | "REVERT_REASON_REQUIRED";

export type StageGateFailure = {
  code: StageGateFailureCode;
  message: string;
};

export type StageGateResult = {
  ok: boolean;
  failures: StageGateFailure[];
};

export type StageGateActor = {
  id: string;
  role: Role | string | null | undefined;
};

export type StageGateMode = "complete" | "request_approval";

export type StageGateSnapshot = {
  orderId: string;
  orderRef: string;
  /** The step being completed, and all of the order's steps. */
  step: PipelineStep;
  steps: PipelineStep[];
  productionUnlockedAt: Date | null;
  notes: string | null;
  mediaCount: number;
  latestApprovalStatus: StageApprovalStatus | null;
  balance: number;
  requirement: StageRequirement;
};


function roleOf(actor: StageGateActor): string {
  return String(actor.role ?? "");
}

function hasRole(actor: StageGateActor, allowed: Role[]): boolean {
  const r = roleOf(actor);
  if (r === Role.SUPER_ADMIN) return true;
  return allowed.includes(r as Role);
}

function isAdminActor(actor: StageGateActor): boolean {
  const r = roleOf(actor);
  return r === Role.SUPER_ADMIN || r === Role.ADMIN;
}

/**
 * The house rules that let a step start, read again at completion: a step that
 * became active before an earlier one was reopened still waits for it.
 */
function orderingFailures(snapshot: StageGateSnapshot): StageGateFailure[] {
  return startBlockers({
    step: { ...snapshot.step, status: OrderStageStatus.PENDING },
    steps: snapshot.steps,
    productionUnlocked: true,
    alongside: false,
  }).map((f) => ({ code: "PREVIOUS_STAGE_INCOMPLETE" as const, message: f.message }));
}

export function evaluateStageGate(params: {
  snapshot: StageGateSnapshot;
  actor: StageGateActor;
  mode?: StageGateMode;
}): StageGateResult {
  const mode = params.mode ?? "complete";
  const { snapshot, actor } = params;
  const stage = snapshot.step.stage;
  const label = stepLabel(snapshot.step);
  const req = snapshot.requirement;
  const failures: StageGateFailure[] = [];

  if (snapshot.step.status !== OrderStageStatus.ACTIVE) {
    failures.push({
      code: "WRONG_STAGE",
      message: `${label} is not in progress.`,
    });
  }

  if (!hasRole(actor, req.requiredRoles)) {
    failures.push({
      code: "FORBIDDEN_ROLE",
      message: "Your role cannot complete this atelier stage.",
    });
  }

  failures.push(...orderingFailures(snapshot));

  if (req.requiresNotes && !snapshot.notes?.trim()) {
    failures.push({
      code: "NOTES_REQUIRED",
      message: `Add notes for ${label} before completing this stage.`,
    });
  }

  if (req.requiresMedia && snapshot.mediaCount < req.minMediaCount) {
    const needed = req.minMediaCount - snapshot.mediaCount;
    failures.push({
      code: "MEDIA_REQUIRED",
      message:
        stage === BespokeStage.DELIVERY
          ? `Upload at least ${req.minMediaCount} delivery photo${req.minMediaCount === 1 ? "" : "s"} for this stage (${needed} more needed).`
          : `Upload at least ${req.minMediaCount} photo${req.minMediaCount === 1 ? "" : "s"} for ${label} (${needed} more needed).`,
    });
  }

  if (req.requiresDepositSatisfied && !snapshot.productionUnlockedAt) {
    failures.push({
      code: "DEPOSIT_NOT_SATISFIED",
      message: "The deposit must be confirmed before production stages can advance.",
    });
  }

  if (mode === "complete" && req.requiresClientApproval) {
    const approvalOk = snapshot.latestApprovalStatus === StageApprovalStatus.APPROVED;
    if (!approvalOk) {
      const pending = snapshot.latestApprovalStatus === StageApprovalStatus.PENDING;
      const changes = snapshot.latestApprovalStatus === StageApprovalStatus.CHANGES_REQUESTED;
      failures.push({
        code: "CLIENT_APPROVAL_PENDING",
        message: pending
          ? `Waiting for the client to approve ${label}.`
          : changes
            ? `The client requested changes on ${label}. Revise and request approval again.`
            : `Request client approval for ${label} before completing this stage.`,
      });
    }
  }

  if (mode === "complete" && req.requiresZeroBalance && !balanceIsCleared(snapshot.balance)) {
    failures.push({
      code: "OUTSTANDING_BALANCE",
      message: `Outstanding balance of ${formatNgnKobo(snapshot.balance)} must be cleared before delivery.`,
    });
  }

  return { ok: failures.length === 0, failures };
}

export function evaluateRevert(params: {
  step: Pick<PipelineStep, "stage" | "label" | "status">;
  actor: StageGateActor;
  reason?: string | null;
}): StageGateResult {
  const failures: StageGateFailure[] = [];
  if (!isAdminActor(params.actor)) {
    failures.push({
      code: "REVERT_FORBIDDEN",
      message: "Only an administrator can move an order backwards.",
    });
  }
  if (params.step.status !== OrderStageStatus.DONE) {
    failures.push({
      code: "REVERT_FORBIDDEN",
      message: `${stepLabel(params.step)} is not done, so there is nothing to reopen.`,
    });
  }
  if (!params.reason?.trim()) {
    failures.push({
      code: "REVERT_REASON_REQUIRED",
      message: "A reason is required to reverse a stage.",
    });
  }
  return { ok: failures.length === 0, failures };
}

async function loadSnapshot(
  orderId: string,
  orderStageId: string,
  submittedNotes?: string | null,
): Promise<StageGateSnapshot | null> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderRef: true,
      productionUnlockedAt: true,
      stageDrafts: { where: { orderStageId }, select: { notes: true } },
      stageMedia: { where: { orderStageId }, select: { id: true } },
      stageApprovals: {
        where: { orderStageId, status: { not: StageApprovalStatus.SUPERSEDED } },
        orderBy: { requestedAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });
  if (!order) return null;
  const steps = await loadSteps(prisma, orderId);
  const step = steps.find((s) => s.id === orderStageId);
  if (!step) return null;

  const summary = await getOrderPaymentSummary(orderId);
  const draftNotes = order.stageDrafts[0]?.notes?.trim() || null;
  const notes = submittedNotes?.trim() || draftNotes;

  return {
    orderId: order.id,
    orderRef: order.orderRef,
    step,
    steps,
    productionUnlockedAt: order.productionUnlockedAt,
    notes,
    mediaCount: order.stageMedia.length,
    latestApprovalStatus: order.stageApprovals[0]?.status ?? null,
    balance: toNumber(summary.balance),
    requirement: stepRequirement(step),
  };
}

export async function canCompleteStage(params: {
  orderId: string;
  orderStageId: string;
  actor: StageGateActor;
  notes?: string | null;
  mode?: StageGateMode;
}): Promise<StageGateResult & { snapshot: StageGateSnapshot | null }> {
  const snapshot = await loadSnapshot(params.orderId, params.orderStageId, params.notes);
  if (!snapshot) {
    return {
      ok: false,
      snapshot: null,
      failures: [{ code: "WRONG_STAGE", message: "Order or step not found." }],
    };
  }
  return {
    snapshot,
    ...evaluateStageGate({
      snapshot,
      actor: params.actor,
      mode: params.mode,
    }),
  };
}

export async function getStageChecklist(orderId: string, orderStageId: string) {
  const snapshot = await loadSnapshot(orderId, orderStageId);
  if (!snapshot) return null;
  const facts = buildStageChecklistFacts({
    step: snapshot.step,
    steps: snapshot.steps,
    draftNotes: snapshot.notes ?? "",
    mediaCount: snapshot.mediaCount,
    latestApprovalStatus: snapshot.latestApprovalStatus,
    productionUnlockedAt: snapshot.productionUnlockedAt,
    balance: snapshot.balance,
  });
  return {
    snapshot,
    items: presentStageChecklist(facts),
  };
}

export { pipelineBlockFor, type PipelineBlock } from "@/lib/atelier/stage-requirements";

export function stageGateInclude() {
  return {
    steps: {
      select: { ...PIPELINE_STEP_SELECT, skippedReason: true, startedAt: true },
      orderBy: { position: "asc" as const },
    },
    // Live completions only — reverted rows must not satisfy PREVIOUS_STAGE_INCOMPLETE.
    stageCompletions: {
      where: { revertedAt: null },
      orderBy: { completedAt: "asc" as const },
    },
    stageMedia: { orderBy: { createdAt: "asc" as const } },
    stageDrafts: true,
    stageApprovals: { orderBy: { requestedAt: "desc" as const } },
  } satisfies Prisma.BespokeOrderInclude;
}

export function bespokeAdminDetailInclude() {
  return {
    stageHistory: { orderBy: { completedAt: "desc" as const } },
    assignments: {
      include: { staffProfile: { include: { user: { select: { id: true, name: true, email: true } } } } },
    },
    materials: { orderBy: { createdAt: "asc" as const } },
    clientProfile: { include: { measurements: true, moodboards: true } },
    quotation: true,
    payments: {
      orderBy: { createdAt: "desc" as const },
      include: { confirmedBy: { select: { id: true, name: true, email: true } } },
    },
    ...stageGateInclude(),
  } satisfies Prisma.BespokeOrderInclude;
}

export function isActiveCompletion<T extends { revertedAt?: Date | string | null }>(row: T): boolean {
  return !row.revertedAt;
}
