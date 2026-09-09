import { BespokeStage, StageApprovalStatus } from "@prisma/client";
import { getPreviousStage, STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { getStageRequirement } from "@/lib/atelier/stage-requirements";
import { formatNGN } from "@/lib/utils";

const ZERO_EPS = 0.01;

export type StageMediaLike = {
  id: string;
  stage: string;
  url: string;
  kind: string;
};

/** Replace this stage's media with the POST body so the checklist updates without a reload. */
export function mergeStageMedia<T extends { currentStage: string; stageMedia?: StageMediaLike[] }>(
  order: T,
  items: StageMediaLike[],
): T {
  return {
    ...order,
    stageMedia: [...(order.stageMedia ?? []).filter((m) => m.stage !== order.currentStage), ...items],
  };
}

export function notesDraftForStage(
  drafts: { stage: string; notes: string }[] | undefined,
  stage: string,
): string {
  return drafts?.find((d) => d.stage === stage)?.notes ?? "";
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
  currentStage: BespokeStage;
  completedStages: Iterable<BespokeStage>;
  draftNotes: string;
  mediaCount: number;
  latestApprovalStatus: StageApprovalStatus | string | null | undefined;
  productionUnlockedAt: Date | string | null | undefined;
  balance: number;
}): ChecklistFact[] {
  const req = getStageRequirement(params.currentStage);
  const completed = params.completedStages instanceof Set
    ? params.completedStages
    : new Set(params.completedStages);
  const prev = getPreviousStage(params.currentStage);
  const approval = params.latestApprovalStatus ?? null;
  const approvalMet = approval === StageApprovalStatus.APPROVED || approval === "APPROVED";
  const mediaMet = req.requiresMedia
    ? params.mediaCount >= req.minMediaCount
    : params.mediaCount >= 1;
  const depositMet = Boolean(params.productionUnlockedAt);
  const balanceMet = params.balance <= ZERO_EPS;

  return [
    {
      key: "prev",
      label: prev ? `${STAGE_SHORT_LABELS[prev]} complete` : "First stage — no predecessor",
      required: Boolean(prev),
      met: !prev || completed.has(prev),
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
        params.currentStage === BespokeStage.DELIVERY
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
        : `Balance outstanding (${formatNGN(params.balance)})`,
      required: req.requiresZeroBalance,
      met: balanceMet,
    },
  ];
}
