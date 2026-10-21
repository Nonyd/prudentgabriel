import { BespokeStage, OrderStageStatus, StageApprovalStatus } from "@prisma/client";
import { balanceIsCleared, formatNgnKobo } from "@/lib/money";
import { sortSteps, startBlockers, stepRequirement, type PipelineStep } from "@/lib/atelier/pipeline";

export type StageMediaLike = {
  id: string;
  orderStageId: string;
  stage: string;
  url: string;
  kind: string;
};

/** Replace this step's media with the POST body so the checklist updates without a reload. */
export function mergeStageMedia<T extends { stageMedia?: StageMediaLike[] }>(
  order: T,
  orderStageId: string,
  items: StageMediaLike[],
): T {
  return {
    ...order,
    stageMedia: [...(order.stageMedia ?? []).filter((m) => m.orderStageId !== orderStageId), ...items],
  };
}

export function notesDraftForStage(
  drafts: { orderStageId: string; notes: string }[] | undefined,
  orderStageId: string,
): string {
  return drafts?.find((d) => d.orderStageId === orderStageId)?.notes ?? "";
}

export type ChecklistFact = {
  key: string;
  label: string;
  required: boolean;
  /** Whether the statement is actually true — never forced true because the row is optional. */
  met: boolean;
};

export type ChecklistDisplay = ChecklistFact & {
  displayLabel: string;
  mark: "tick" | "open" | "none";
  tone: "done" | "unmet" | "not_required";
};

export function presentChecklistRow(row: ChecklistFact): ChecklistDisplay {
  if (row.met) {
    return { ...row, displayLabel: row.label, mark: "tick", tone: "done" };
  }
  if (!row.required) {
    return {
      ...row,
      displayLabel: "Not required at this stage",
      mark: "none",
      tone: "not_required",
    };
  }
  return { ...row, displayLabel: row.label, mark: "open", tone: "unmet" };
}

export function presentStageChecklist(facts: ChecklistFact[]): ChecklistDisplay[] {
  return facts.map(presentChecklistRow);
}

export function buildStageChecklistFacts(params: {
  /** The step being completed, and all of the order's steps. */
  step: PipelineStep;
  steps: readonly PipelineStep[];
  draftNotes: string;
  mediaCount: number;
  latestApprovalStatus: StageApprovalStatus | string | null | undefined;
  productionUnlockedAt: Date | string | null | undefined;
  balance: number;
}): ChecklistFact[] {
  const req = stepRequirement(params.step);
  // The house rules for this step to run (earlier intake steps, Design Approval, Delivery last).
  const ordering = startBlockers({
    step: { ...params.step, status: OrderStageStatus.PENDING },
    steps: params.steps,
    productionUnlocked: true,
    alongside: false,
  });
  const isFirst = sortSteps(params.steps)[0]?.id === params.step.id;
  const approval = params.latestApprovalStatus ?? null;
  const approvalMet = approval === StageApprovalStatus.APPROVED || approval === "APPROVED";
  const mediaMet = req.requiresMedia
    ? params.mediaCount >= req.minMediaCount
    : params.mediaCount >= 1;
  const depositMet = Boolean(params.productionUnlockedAt);
  const balanceMet = balanceIsCleared(params.balance);

  return [
    {
      key: "prev",
      label: isFirst ? "First stage — no predecessor" : ordering[0]?.message ?? "Earlier steps complete",
      required: !isFirst,
      met: ordering.length === 0,
    },
    {
      key: "notes",
      label: "Notes added",
      required: req.requiresNotes,
      met: Boolean(params.draftNotes.trim()),
    },
    {
      key: "media",
      label:
        params.step.stage === BespokeStage.DELIVERY
          ? `${params.mediaCount}/${req.minMediaCount || 1} delivery photo(s) uploaded`
          : `${params.mediaCount}/${Math.max(req.minMediaCount, 1)} photo(s) uploaded`,
      required: req.requiresMedia,
      met: mediaMet,
    },
    {
      key: "approval",
      label: approvalMet
        ? "Client approval received"
        : approval === StageApprovalStatus.PENDING || approval === "PENDING"
          ? "Waiting for client approval"
          : approval === StageApprovalStatus.CHANGES_REQUESTED || approval === "CHANGES_REQUESTED"
            ? "Client requested changes"
            : req.requiresClientApproval
              ? "Client approval needed"
              : "Client approval",
      required: req.requiresClientApproval,
      met: approvalMet,
    },
    {
      key: "deposit",
      label: "Deposit satisfied",
      required: req.requiresDepositSatisfied,
      met: depositMet,
    },
    {
      key: "balance",
      label: balanceMet
        ? "Balance cleared"
        : `Balance outstanding (${formatNgnKobo(params.balance)})`,
      required: req.requiresZeroBalance,
      met: balanceMet,
    },
  ];
}
