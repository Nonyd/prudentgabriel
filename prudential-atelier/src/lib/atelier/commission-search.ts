import { BespokeStage, OrderStatus, Prisma } from "@prisma/client";
import { commissionHasFeaturesWhere, parseFeatureKeys } from "@/lib/atelier/construction-features";
import { deliveryMonthWhere, parseDeliveryMonth } from "@/lib/atelier/delivery-month";

/**
 * The commission list's filters (GET /api/bespoke), in one place so tests run
 * the same query the pipeline does.
 *
 *   stage, status, search, from/to (created), showArchived=1, awaitingReceipt=1
 *   feature=cup_corset,train   BC2: commissions carrying every listed feature
 *   deliveryMonth=2026-05      BC3: expected delivery in that Lagos month
 */
export type CommissionSearch =
  | {
      ok: true;
      where: Prisma.BespokeOrderWhereInput;
      orderBy: Prisma.BespokeOrderOrderByWithRelationInput[];
    }
  | { ok: false; error: string };

const STAGES = new Set<string>(Object.values(BespokeStage));
const STATUSES = new Set<string>(Object.values(OrderStatus));

export function commissionSearch(params: URLSearchParams): CommissionSearch {
  const stage = params.get("stage");
  const status = params.get("status");
  const search = params.get("search")?.trim();
  const from = params.get("from");
  const to = params.get("to");
  const showArchived = params.get("showArchived") === "1";
  const awaitingReceipt = params.get("awaitingReceipt") === "1";
  const monthRaw = params.get("deliveryMonth");
  const featureKeys = parseFeatureKeys(params.get("feature"));

  const where: Prisma.BespokeOrderWhereInput = {};
  if (stage && stage !== "all" && STAGES.has(stage)) where.currentStage = stage as BespokeStage;
  if (status && status !== "all" && STATUSES.has(status)) {
    where.status = status as OrderStatus;
  } else if (!showArchived) {
    where.status = { not: OrderStatus.ARCHIVED };
  }
  if (awaitingReceipt) {
    where.deliveredAt = { not: null };
    where.receiptConfirmedAt = null;
    where.status = { in: [OrderStatus.DELIVERED] };
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (search) {
    where.OR = [
      { orderRef: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
      { clientEmail: { contains: search, mode: "insensitive" } },
    ];
  }

  const and: Prisma.BespokeOrderWhereInput[] = [];
  if (featureKeys.length) and.push(commissionHasFeaturesWhere(featureKeys));

  let orderBy: Prisma.BespokeOrderOrderByWithRelationInput[] = [{ createdAt: "desc" }];
  if (monthRaw) {
    const month = parseDeliveryMonth(monthRaw);
    if (!month) return { ok: false, error: "deliveryMonth must look like 2026-05" };
    and.push(deliveryMonthWhere(month));
    // A month's deliveries read soonest first.
    orderBy = [{ deliveryDate: "asc" }, { createdAt: "asc" }];
  }
  if (and.length) where.AND = and;

  return { ok: true, where, orderBy };
}
