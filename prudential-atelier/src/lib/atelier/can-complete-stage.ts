import {
  BespokeStage,
  Role,
  StageApprovalStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatNGN } from "@/lib/utils";
import { getPreviousStage, STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { getOrderPaymentSummary, toNumber } from "@/lib/payments/ledger";
import { getStageRequirement, stageIndex, type StageRequirement } from "@/lib/atelier/stage-requirements";
import { buildStageChecklistFacts, presentStageChecklist } from "@/lib/atelier/stage-checklist";

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
  currentStage: BespokeStage;
  productionUnlockedAt: Date | null;
  completedStages: BespokeStage[];
  notes: string | null;
  mediaCount: number;
  latestApprovalStatus: StageApprovalStatus | null;
  balance: number;
  requirement: StageRequirement;
};

const ZERO_EPS = 0.01;

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

export function evaluateStageGate(params: {
  snapshot: StageGateSnapshot;
  stage: BespokeStage;
  actor: StageGateActor;
  mode?: StageGateMode;
}): StageGateResult {
  const mode = params.mode ?? "complete";
  const { snapshot, stage, actor } = params;
  const req = snapshot.requirement;
  const failures: StageGateFailure[] = [];

  if (snapshot.currentStage !== stage) {
    failures.push({
      code: "WRONG_STAGE",
      message: `This order is on ${STAGE_SHORT_LABELS[snapshot.currentStage]}, not ${STAGE_SHORT_LABELS[stage]}.`,
    });
  }

  if (!hasRole(actor, req.requiredRoles)) {
    failures.push({
      code: "FORBIDDEN_ROLE",
      message: "Your role cannot complete this atelier stage.",
    });
  }

  const prev = getPreviousStage(stage);
  if (prev && !snapshot.completedStages.includes(prev)) {
    failures.push({
      code: "PREVIOUS_STAGE_INCOMPLETE",
      message: `${STAGE_SHORT_LABELS[prev]} must be completed before ${STAGE_SHORT_LABELS[stage]}.`,
    });
  }

  if (req.requiresNotes && !snapshot.notes?.trim()) {
    failures.push({
      code: "NOTES_REQUIRED",
      message: `Add notes for ${STAGE_SHORT_LABELS[stage]} before completing this stage.`,
    });
  }

  if (req.requiresMedia && snapshot.mediaCount < req.minMediaCount) {
    const needed = req.minMediaCount - snapshot.mediaCount;
    failures.push({
      code: "MEDIA_REQUIRED",
      message:
        stage === BespokeStage.DELIVERY
          ? `Upload at least ${req.minMediaCount} delivery photo${req.minMediaCount === 1 ? "" : "s"} for this stage (${needed} more needed).`
          : `Upload at least ${req.minMediaCount} photo${req.minMediaCount === 1 ? "" : "s"} for ${STAGE_SHORT_LABELS[stage]} (${needed} more needed).`,
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
          ? `Waiting for the client to approve ${STAGE_SHORT_LABELS[stage]}.`
          : changes
            ? `The client requested changes on ${STAGE_SHORT_LABELS[stage]}. Revise and request approval again.`
            : `Request client approval for ${STAGE_SHORT_LABELS[stage]} before completing this stage.`,
      });
    }
  }

  if (mode === "complete" && req.requiresZeroBalance && snapshot.balance > ZERO_EPS) {
    failures.push({
      code: "OUTSTANDING_BALANCE",
      message: `Outstanding balance of ${formatNGN(snapshot.balance)} must be cleared before delivery.`,
    });
  }

  return { ok: failures.length === 0, failures };
}

export function evaluateRevert(params: {
  currentStage: BespokeStage;
  targetStage: BespokeStage;
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
  if (stageIndex(params.targetStage) >= stageIndex(params.currentStage)) {
    failures.push({
      code: "REVERT_FORBIDDEN",
      message: "Revert target must be an earlier stage than the current one.",
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
  stage: BespokeStage,
  submittedNotes?: string | null,
): Promise<StageGateSnapshot | null> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderRef: true,
      currentStage: true,
      productionUnlockedAt: true,
      stageCompletions: {
        where: { revertedAt: null },
        select: { stage: true },
      },
      stageDrafts: { where: { stage }, select: { notes: true } },
      stageMedia: { where: { stage }, select: { id: true } },
      stageApprovals: {
        where: { stage, status: { not: StageApprovalStatus.SUPERSEDED } },
        orderBy: { requestedAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });
  if (!order) return null;

  const summary = await getOrderPaymentSummary(orderId);
  const draftNotes = order.stageDrafts[0]?.notes?.trim() || null;
  const notes = submittedNotes?.trim() || draftNotes;

  return {
    orderId: order.id,
    orderRef: order.orderRef,
    currentStage: order.currentStage,
    productionUnlockedAt: order.productionUnlockedAt,
    completedStages: order.stageCompletions.map((c) => c.stage),
    notes,
    mediaCount: order.stageMedia.length,
    latestApprovalStatus: order.stageApprovals[0]?.status ?? null,
    balance: toNumber(summary.balance),
    requirement: getStageRequirement(stage),
  };
}

export async function canCompleteStage(params: {
  orderId: string;
  stage: BespokeStage;
  actor: StageGateActor;
  notes?: string | null;
  mode?: StageGateMode;
}): Promise<StageGateResult & { snapshot: StageGateSnapshot | null }> {
  const snapshot = await loadSnapshot(params.orderId, params.stage, params.notes);
  if (!snapshot) {
    return {
      ok: false,
      snapshot: null,
      failures: [{ code: "WRONG_STAGE", message: "Order not found." }],
    };
  }
  return {
    snapshot,
    ...evaluateStageGate({
      snapshot,
      stage: params.stage,
      actor: params.actor,
      mode: params.mode,
    }),
  };
}

export async function getStageChecklist(orderId: string, stage: BespokeStage) {
  const snapshot = await loadSnapshot(orderId, stage);
  if (!snapshot) return null;
  const facts = buildStageChecklistFacts({
    currentStage: stage,
    completedStages: snapshot.completedStages,
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
