import { BespokeStage, Role } from "@prisma/client";
import { STAGE_ORDER } from "@/lib/bespoke-stages";

export type StageRequirement = {
  requiresNotes: boolean;
  requiresMedia: boolean;
  minMediaCount: number;
  requiresClientApproval: boolean;
  requiresDepositSatisfied: boolean;
  requiresZeroBalance: boolean;
  requiredRoles: Role[];
};

/**
 * Production begins at SKETCHING_CONCEPT (stage 5) — first atelier-floor stage
 * after payment confirmation. Deposit is required from here onward.
 * Stages 1–4 (booking → payment confirmation) do not gate on deposit;
 * requiring it on PAYMENT_CONFIRMATION would deadlock the deposit itself.
 */
export const PRODUCTION_START_STAGE: BespokeStage = BespokeStage.SKETCHING_CONCEPT;

const ATELIER_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.STAFF_ADMIN,
  Role.BESPOKE_MANAGER,
  Role.STAFF,
];

function base(overrides: Partial<StageRequirement> = {}): StageRequirement {
  return {
    requiresNotes: true,
    requiresMedia: false,
    minMediaCount: 0,
    requiresClientApproval: false,
    requiresDepositSatisfied: false,
    requiresZeroBalance: false,
    requiredRoles: ATELIER_ROLES,
    ...overrides,
  };
}

const media = (min = 1): Partial<StageRequirement> => ({
  requiresMedia: true,
  minMediaCount: min,
});

export const STAGE_REQUIREMENTS: Record<BespokeStage, StageRequirement> = {
  [BespokeStage.CONSULTATION_BOOKING]: base(),
  [BespokeStage.CONSULTATION_SESSION]: base(),
  [BespokeStage.INVOICE_ISSUANCE]: base(),
  [BespokeStage.PAYMENT_CONFIRMATION]: base(),
  [BespokeStage.SKETCHING_CONCEPT]: base({
    ...media(1),
    requiresDepositSatisfied: true,
  }),
  [BespokeStage.FABRIC_SOURCING]: base({
    ...media(1),
    requiresDepositSatisfied: true,
  }),
  [BespokeStage.DESIGN_APPROVAL]: base({
    ...media(1),
    requiresClientApproval: true,
    requiresDepositSatisfied: true,
  }),
  [BespokeStage.TAILORING]: base({
    ...media(1),
    requiresDepositSatisfied: true,
  }),
  [BespokeStage.FIRST_FITTING]: base({ requiresDepositSatisfied: true }),
  [BespokeStage.ALTERATIONS]: base({ requiresDepositSatisfied: true }),
  [BespokeStage.BEADING_FINISHING]: base({
    ...media(1),
    requiresDepositSatisfied: true,
  }),
  [BespokeStage.FINAL_FITTING]: base({
    ...media(1),
    requiresClientApproval: true,
    requiresDepositSatisfied: true,
  }),
  [BespokeStage.DELIVERY]: base({
    ...media(1),
    requiresDepositSatisfied: true,
    requiresZeroBalance: true,
  }),
};

export function getStageRequirement(stage: BespokeStage): StageRequirement {
  return STAGE_REQUIREMENTS[stage];
}

export function stageIndex(stage: BespokeStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function isProductionStage(stage: BespokeStage): boolean {
  return stageIndex(stage) >= stageIndex(PRODUCTION_START_STAGE);
}

const ZERO_EPS = 0.01;

export type PipelineBlock = "CLIENT_APPROVAL" | "OUTSTANDING_BALANCE" | null;

export function pipelineBlockFor(params: {
  currentStage: BespokeStage;
  pendingApproval: boolean;
  balance: number;
}): PipelineBlock {
  const req = getStageRequirement(params.currentStage);
  if (req.requiresClientApproval && params.pendingApproval) return "CLIENT_APPROVAL";
  if (req.requiresZeroBalance && params.balance > ZERO_EPS) return "OUTSTANDING_BALANCE";
  return null;
}
