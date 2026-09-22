import { prisma } from "@/lib/prisma";
import { BESPOKE_MANAGER_ROLES, sessionHasRole } from "@/lib/bespoke-roles";

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

type WithPayments = { payments?: unknown[] };
type WithClientMeasurements = { clientProfile?: ({ measurements?: unknown } & Record<string, unknown>) | null };

/**
 * Strip what the caller may not see from a bespoke order payload.
 * Hidden fields become empty (not absent) so existing screens keep rendering,
 * and the `…Hidden` flags let a screen say why.
 */
export function redactBespokeOrder<T extends WithPayments & WithClientMeasurements>(
  order: T,
  access: { payments: boolean; measurements: boolean },
): T & { paymentsHidden: boolean; measurementsHidden: boolean } {
  const out = { ...order } as T & { paymentsHidden: boolean; measurementsHidden: boolean };
  if (!access.payments && "payments" in out) out.payments = [];
  if (!access.measurements && out.clientProfile) {
    out.clientProfile = { ...out.clientProfile, measurements: null };
  }
  out.paymentsHidden = !access.payments;
  out.measurementsHidden = !access.measurements;
  return out;
}
