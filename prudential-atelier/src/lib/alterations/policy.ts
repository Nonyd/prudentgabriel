/**
 * Post-delivery alteration pricing policy.
 *
 * CMS: `alteration_warranty_days` (default 30).
 * Within the warranty window AND reason is FIT or WORKMANSHIP → FREE by default.
 * Outside the window, or reason is CHANGE_REQUESTED / DAMAGE / OTHER → CHARGEABLE.
 * Admin may override either way; overrides must record a reason.
 * FREE accepts require complimentaryEstimatedValue (reporting cost).
 * CHARGEABLE accepts create a Quotation via the existing quote → invoice → payment path.
 */
import { AlterationPricing, AlterationReason } from "@prisma/client";
import { getSetting } from "@/lib/settings";

export const DEFAULT_ALTERATION_WARRANTY_DAYS = 30;

export async function getAlterationWarrantyDays(): Promise<number> {
  const raw = await getSetting("alteration_warranty_days");
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_ALTERATION_WARRANTY_DAYS;
  return Math.floor(n);
}

export function alterationWindowClosesAt(
  receiptConfirmedAt: Date,
  warrantyDays: number,
): Date {
  return new Date(receiptConfirmedAt.getTime() + warrantyDays * 86_400_000);
}

/** The window opens when she confirms receipt — not when the house marks delivered. */
export function isAlterationWindowOpen(params: {
  receiptConfirmedAt: Date | null;
  warrantyDays: number;
  now?: Date;
}): boolean {
  if (!params.receiptConfirmedAt) return false;
  const now = params.now ?? new Date();
  return now.getTime() < alterationWindowClosesAt(params.receiptConfirmedAt, params.warrantyDays).getTime();
}

export function suggestAlterationPricing(params: {
  reason: AlterationReason;
  deliveredAt: Date | null;
  receiptConfirmedAt?: Date | null;
  warrantyDays: number;
  now?: Date;
}): AlterationPricing {
  const now = params.now ?? new Date();
  const windowStart = params.receiptConfirmedAt ?? params.deliveredAt;
  const withinWarranty =
    !!windowStart &&
    now.getTime() - windowStart.getTime() <= params.warrantyDays * 86_400_000;

  if (
    withinWarranty &&
    (params.reason === AlterationReason.FIT || params.reason === AlterationReason.WORKMANSHIP)
  ) {
    return AlterationPricing.FREE;
  }
  return AlterationPricing.CHARGEABLE;
}

export const OPEN_ALTERATION_STATUSES = ["REQUESTED", "ACCEPTED", "IN_PROGRESS"] as const;
