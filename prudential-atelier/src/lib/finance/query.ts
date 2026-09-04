import { prisma } from "@/lib/prisma";
import {
  classifyPayments,
  combinedTotals,
  money,
  totalsFor,
  type ClassifiedLine,
  type FinanceLine,
  type FinancePaymentSnap,
  type LineTotals,
} from "@/lib/finance/classify";
import { inRange } from "@/lib/finance/period";
import { getPointRateNGN, outstandingPointsTotal, pointsToNaira } from "@/lib/points";

function clientLabel(p: {
  order: { guestName: string | null; guestEmail: string | null; user: { name: string | null; email: string } | null } | null;
  invoice: { clientName: string; clientEmail: string } | null;
  consultation: { clientName: string; clientEmail: string } | null;
  bespokeOrder: { clientName: string; clientEmail: string } | null;
}): string {
  if (p.order?.user?.name) return p.order.user.name;
  if (p.order?.guestName) return p.order.guestName;
  if (p.order?.user?.email) return p.order.user.email;
  if (p.order?.guestEmail) return p.order.guestEmail;
  if (p.bespokeOrder?.clientName) return p.bespokeOrder.clientName;
  if (p.invoice?.clientName) return p.invoice.clientName;
  if (p.consultation?.clientName) return p.consultation.clientName;
  return p.invoice?.clientEmail ?? p.consultation?.clientEmail ?? p.bespokeOrder?.clientEmail ?? "—";
}

export async function loadFinanceSnaps(from: Date, to: Date): Promise<FinancePaymentSnap[]> {
  const ranged = await prisma.payment.findMany({
    where: {
      OR: [
        { confirmedAt: { gte: from, lt: to } },
        { confirmedAt: null, createdAt: { gte: from, lt: to } },
      ],
    },
    select: { id: true, orderId: true },
  });
  const orderIds = Array.from(new Set(ranged.map((r) => r.orderId).filter((id): id is string => Boolean(id))));
  const extraIds =
    orderIds.length === 0
      ? []
      : (
          await prisma.payment.findMany({
            where: { orderId: { in: orderIds }, purpose: "RTW_ORDER" },
            select: { id: true },
          })
        ).map((r) => r.id);
  const ids = Array.from(new Set(ranged.map((r) => r.id).concat(extraIds)));
  if (ids.length === 0) return [];

  const rows = await prisma.payment.findMany({
    where: { id: { in: ids } },
    include: {
      confirmedBy: { select: { name: true, email: true } },
      order: {
        select: {
          orderNumber: true,
          shippingAmount: true,
          total: true,
          currency: true,
          fxRateLocked: true,
          fxGbpRateLocked: true,
          fxUsdAmountLocked: true,
          status: true,
          paymentStatus: true,
          refundRecordedAt: true,
          guestName: true,
          guestEmail: true,
          user: { select: { name: true, email: true } },
        },
      },
      invoice: {
        select: {
          invoiceNumber: true,
          total: true,
          vatAmount: true,
          vatEnabled: true,
          currency: true,
          exchangeRate: true,
          clientName: true,
          clientEmail: true,
        },
      },
      consultation: { select: { bookingNumber: true, clientName: true, clientEmail: true } },
      bespokeOrder: { select: { orderRef: true, clientName: true, clientEmail: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const snaps: FinancePaymentSnap[] = rows.map((p) => ({
    id: p.id,
    reference: p.reference,
    amount: Number(p.amount),
    currency: p.currency,
    method: p.method,
    status: p.status,
    purpose: p.purpose,
    confirmedAt: p.confirmedAt,
    createdAt: p.createdAt,
    confirmedByName: p.confirmedBy?.name ?? p.confirmedBy?.email ?? null,
    clientLabel: clientLabel(p),
    orderId: p.orderId,
    bespokeOrderId: p.bespokeOrderId,
    invoiceId: p.invoiceId,
    consultationId: p.consultationId,
    order: p.order
      ? {
          orderNumber: p.order.orderNumber,
          shippingAmount: p.order.shippingAmount,
          total: p.order.total,
          currency: String(p.order.currency),
          fxRateLocked: p.order.fxRateLocked,
          fxGbpRateLocked: p.order.fxGbpRateLocked,
          fxUsdAmountLocked: p.order.fxUsdAmountLocked,
          status: p.order.status,
          paymentStatus: p.order.paymentStatus,
          refundRecordedAt: p.order.refundRecordedAt,
        }
      : null,
    invoice: p.invoice
      ? {
          invoiceNumber: p.invoice.invoiceNumber,
          total: p.invoice.total,
          vatAmount: p.invoice.vatAmount,
          vatEnabled: p.invoice.vatEnabled,
          currency: p.invoice.currency,
          exchangeRate: p.invoice.exchangeRate,
        }
      : null,
    consultationRef: p.consultation?.bookingNumber ?? null,
    bespokeRef: p.bespokeOrder?.orderRef ?? null,
  }));

  return snaps;
}

export function linesInRange(lines: ClassifiedLine[], from: Date, to: Date): ClassifiedLine[] {
  return lines.filter((l) => inRange(l.at, from, to));
}

export type FinanceReport = {
  from: string;
  to: string;
  lines: ClassifiedLine[];
  rtw: LineTotals;
  atelier: LineTotals;
  combined: LineTotals;
  unassigned: ClassifiedLine[];
  bank: { bucket: string; cashNGN: number }[];
  pointsLiabilityNGN: number;
  pointsOutstanding: number;
  pointsRateNGN: number;
  asOf: string;
};

export function reportFromLines(lines: ClassifiedLine[], from: Date, to: Date, extra?: {
  pointsOutstanding?: number;
  pointsRateNGN?: number;
  asOf?: Date;
}): FinanceReport {
  const rtw = totalsFor(lines, "RTW");
  const atelier = totalsFor(lines, "ATELIER");
  const combined = combinedTotals(lines);
  const unassigned = lines.filter((l) => l.resolution === "neither" || l.resolution === "both");
  const buckets = new Map<string, number>();
  for (const row of lines) {
    if (row.cashNGN <= 0) continue;
    buckets.set(row.bankBucket, money((buckets.get(row.bankBucket) ?? 0) + row.cashNGN));
  }
  const pointsOutstanding = extra?.pointsOutstanding ?? 0;
  const pointsRateNGN = extra?.pointsRateNGN ?? 1;
  const asOf = extra?.asOf ?? new Date();
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    lines,
    rtw,
    atelier,
    combined,
    unassigned,
    bank: Array.from(buckets.entries()).map(([bucket, cashNGN]) => ({ bucket, cashNGN })),
    pointsLiabilityNGN: pointsToNaira(pointsOutstanding, pointsRateNGN),
    pointsOutstanding,
    pointsRateNGN,
    asOf: asOf.toISOString(),
  };
}

export async function buildFinanceReport(from: Date, to: Date, line?: FinanceLine): Promise<FinanceReport> {
  const snaps = await loadFinanceSnaps(from, to);
  let classified = linesInRange(classifyPayments(snaps), from, to);
  if (line === "RTW" || line === "ATELIER") {
    classified = classified.filter((r) => r.businessLine === line);
  }
  const [pointsOutstanding, pointsRateNGN] = await Promise.all([outstandingPointsTotal(), getPointRateNGN()]);
  return reportFromLines(classified, from, to, { pointsOutstanding, pointsRateNGN, asOf: new Date() });
}

export async function bestSellingPieces(from: Date, to: Date, take = 8): Promise<{ name: string; quantity: number; salesNGN: number }[]> {
  const snaps = await loadFinanceSnaps(from, to);
  const classified = linesInRange(classifyPayments(snaps), from, to);
  const orderIds = Array.from(
    new Set(
      classified.filter((r) => r.businessLine === "RTW" && r.salesNGN > 0 && r.resolution === "rtw").map((r) => {
        const snap = snaps.find((s) => s.id === r.id);
        return snap?.orderId;
      }),
    ),
  ).filter((id): id is string => Boolean(id));
  if (orderIds.length === 0) return [];
  const items = await prisma.orderItem.findMany({
    where: { orderId: { in: orderIds } },
    select: { quantity: true, lineTotal: true, product: { select: { name: true } } },
  });
  const map = new Map<string, { quantity: number; salesNGN: number }>();
  for (const it of items) {
    const cur = map.get(it.product.name) ?? { quantity: 0, salesNGN: 0 };
    cur.quantity += it.quantity;
    cur.salesNGN = money(cur.salesNGN + it.lineTotal);
    map.set(it.product.name, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.quantity - a.quantity || b.salesNGN - a.salesNGN)
    .slice(0, take);
}
