import { prisma } from "@/lib/prisma";
import { BESPOKE_MANAGER_ROLES, sessionHasRole } from "@/lib/bespoke-roles";
import { balanceIsCleared } from "@/lib/money";

/**
 * Slice AZ8 — who may read a client's measurements and payment receipts,
 * enforced in the API response (per Slice T: hiding a field in the UI is not a
 * control).
 *
 * - Payments, and their receipt URLs, belong to whoever handles money:
 *   bespoke managers and finance. Never floor STAFF.
 * - Measurements belong to whoever cuts the garment: managers, and STAFF
 *   assigned to the order as a tailor or pattern cutter. Not beaders or
 *   designers, and not STAFF with no assignment on that client.
 */

export const PAYMENT_DETAIL_ROLES = [...BESPOKE_MANAGER_ROLES, "FINANCE_MANAGER"];

/** OrderAssignment.role values whose holder cuts or constructs the garment. */
export const MEASUREMENT_ASSIGNMENT_ROLES = ["TAILOR", "PATTERN_CUTTER"];

export type AccessUser = { id?: string | null; role?: string | null; email?: string | null };

export function canSeePaymentDetails(user: AccessUser): boolean {
  return sessionHasRole(user.role, user.email, PAYMENT_DETAIL_ROLES);
}

function isBespokeManager(user: AccessUser): boolean {
  return sessionHasRole(user.role, user.email, BESPOKE_MANAGER_ROLES);
}

/** Managers always; STAFF only when assigned to this order as a cutter/tailor. */
export async function canSeeOrderMeasurements(user: AccessUser, orderId: string): Promise<boolean> {
  if (isBespokeManager(user)) return true;
  if (!user.id) return false;
  const hit = await prisma.orderAssignment.findFirst({
    where: {
      orderId,
      role: { in: MEASUREMENT_ASSIGNMENT_ROLES },
      staffProfile: { userId: user.id },
    },
    select: { id: true },
  });
  return Boolean(hit);
}

/** Managers always; STAFF only when cutting/tailoring one of this client's orders. */
export async function canSeeClientMeasurements(user: AccessUser, clientProfileId: string): Promise<boolean> {
  if (isBespokeManager(user)) return true;
  if (!user.id) return false;
  const hit = await prisma.orderAssignment.findFirst({
    where: {
      role: { in: MEASUREMENT_ASSIGNMENT_ROLES },
      staffProfile: { userId: user.id },
      order: { clientProfileId },
    },
    select: { id: true },
  });
  return Boolean(hit);
}

type WithOrderReceipt = { paymentReceiptUrl?: string | null; paymentRef?: string | null };

/**
 * The commission row itself carries the last bank-transfer receipt URL and its
 * reference (written by the client's transfer upload). Those are payment
 * details too: blank them for anyone who may not see payments.
 */
export function stripOrderReceipt<T extends WithOrderReceipt>(order: T): T {
  if (!("paymentReceiptUrl" in order) && !("paymentRef" in order)) return order;
  return {
    ...order,
    ...("paymentReceiptUrl" in order ? { paymentReceiptUrl: null } : {}),
    ...("paymentRef" in order ? { paymentRef: null } : {}),
  };
}

type WithPayments = {
  payments?: unknown[];
  totalAmount?: number | null;
  amountPaid?: number | null;
  balance?: number | null;
  quotation?: (Record<string, unknown> & { id: string }) | null;
  materials?: ({ unitCost?: number | null; totalCost?: number | null } & Record<string, unknown>)[];
} & WithOrderReceipt;
type WithClientMeasurements = { clientProfile?: ({ measurements?: unknown } & Record<string, unknown>) | null };

/** Quotation fields that are not money: who, when, which version. */
const QUOTE_SAFE_KEYS = ["id", "quoteRef", "version", "status", "sentAt", "approvedAt", "expectedDeliveryDate", "currency"];

/**
 * Strip what the caller may not see from a bespoke order payload.
 * Hidden fields become empty (not absent) so existing screens keep rendering,
 * and the `…Hidden` flags let a screen say why.
 *
 * BD4 (closing the BC leftover): without money the cached total, paid and
 * balance go too, and the quotation keeps only its reference and dates.
 * Material unit and total costs need `materialCost` (store or cost of production).
 */
export function redactBespokeOrder<T extends WithPayments & WithClientMeasurements>(
  order: T,
  access: { payments: boolean; measurements: boolean; materialCost?: boolean },
): T & { paymentsHidden: boolean; measurementsHidden: boolean; materialCostHidden: boolean; balanceCleared?: boolean } {
  const base = access.payments ? order : stripOrderReceipt(order);
  const out = { ...base } as T & {
    paymentsHidden: boolean;
    measurementsHidden: boolean;
    materialCostHidden: boolean;
    balanceCleared?: boolean;
  };
  // Whether it is cleared is what the pipeline already shows ("Awaiting balance"); the figure is not.
  if (typeof order.balance === "number") out.balanceCleared = balanceIsCleared(order.balance);
  if (!access.payments) {
    if ("payments" in out) out.payments = [];
    if ("totalAmount" in out) out.totalAmount = null;
    if ("amountPaid" in out) out.amountPaid = null;
    if ("balance" in out) out.balance = null;
    if (out.quotation) {
      const q = out.quotation;
      out.quotation = Object.fromEntries(QUOTE_SAFE_KEYS.filter((k) => k in q).map((k) => [k, q[k]])) as typeof q;
    }
  }
  const materialCost = access.materialCost ?? false;
  if (!materialCost && Array.isArray(out.materials)) {
    out.materials = out.materials.map((m) => ({ ...m, unitCost: null, totalCost: null }));
  }
  out.materialCostHidden = !materialCost;
  if (!access.measurements && out.clientProfile) {
    out.clientProfile = { ...out.clientProfile, measurements: null };
  }
  out.paymentsHidden = !access.payments;
  out.measurementsHidden = !access.measurements;
  return out;
}
