import { RequisitionStatus } from "@prisma/client";
import type { AdminPermission } from "@/lib/roles";

/** Forward-only edges. Decline is handled separately from any non-terminal state. */
export const REQUISITION_FORWARD: Partial<Record<RequisitionStatus, RequisitionStatus>> = {
  RAISED: "STOCK_CHECKED",
  STOCK_CHECKED: "WITH_ACCOUNTS",
  WITH_ACCOUNTS: "AWAITING_FUNDS",
  AWAITING_FUNDS: "FUNDED",
  FUNDED: "PURCHASED",
  PURCHASED: "RECEIVED",
  RECEIVED: "CLOSED",
};

export const REQUISITION_PERMISSION: Partial<Record<RequisitionStatus, AdminPermission | "fund_admin">> = {
  STOCK_CHECKED: "requisition.approve",
  WITH_ACCOUNTS: "payments",
  AWAITING_FUNDS: "payments",
  FUNDED: "fund_admin",
  PURCHASED: "requisition.buy",
  RECEIVED: "requisition.approve",
  CLOSED: "store",
};

export const TERMINAL_REQUISITION: RequisitionStatus[] = ["CLOSED", "DECLINED"];

/** AQ13 / AQ6: funding is Mrs. Prudent (ADMIN) only — never SUPER_ADMIN, never finance. */
export function canFundRequisition(role: string | null | undefined): boolean {
  return role === "ADMIN";
}

export function nextRequisitionStatus(from: RequisitionStatus): RequisitionStatus | null {
  return REQUISITION_FORWARD[from] ?? null;
}

export function canAdvanceRequisition(
  from: RequisitionStatus,
  to: RequisitionStatus,
): boolean {
  return nextRequisitionStatus(from) === to;
}

export function permissionForTransition(to: RequisitionStatus): AdminPermission | "fund_admin" | null {
  return REQUISITION_PERMISSION[to] ?? null;
}

export function newRequisitionRef(at = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  const d = String(at.getUTCDate()).padStart(2, "0");
  const n = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REQ-${y}${m}${d}-${n}`;
}

export const STATUS_LABEL: Record<RequisitionStatus, string> = {
  RAISED: "Raised",
  STOCK_CHECKED: "Stock checked",
  WITH_ACCOUNTS: "With accounts",
  AWAITING_FUNDS: "Awaiting funds",
  FUNDED: "Funded",
  PURCHASED: "Purchased",
  RECEIVED: "Received",
  CLOSED: "Closed",
  DECLINED: "Declined",
};
