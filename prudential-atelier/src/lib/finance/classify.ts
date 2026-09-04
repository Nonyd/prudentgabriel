import { PaymentMethod, PaymentPurpose, PaymentStatus } from "@prisma/client";

export type FinanceLine = "RTW" | "ATELIER" | "UNASSIGNED";
export type LineResolution = "rtw" | "atelier" | "neither" | "both";
export type AtelierKind = "commission" | "consultation" | "invoice" | null;

export type FinanceOrderSnap = {
  orderNumber: string;
  shippingAmount: number;
  total: number;
  currency: string;
  fxRateLocked: number | null;
  fxGbpRateLocked: number | null;
  fxUsdAmountLocked: number | null;
  status: string;
  paymentStatus: string;
  refundRecordedAt: Date | null;
};

export type FinanceInvoiceSnap = {
  invoiceNumber: string;
  total: number;
  vatAmount: number;
  vatEnabled: boolean;
  currency: string;
  exchangeRate: number;
};

export type FinancePaymentSnap = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  purpose: string;
  confirmedAt: Date | null;
  createdAt: Date;
  confirmedByName: string | null;
  clientLabel: string;
  orderId: string | null;
  bespokeOrderId: string | null;
  invoiceId: string | null;
  consultationId: string | null;
  order: FinanceOrderSnap | null;
  invoice: FinanceInvoiceSnap | null;
  consultationRef: string | null;
  bespokeRef: string | null;
};

export type ClassifiedLine = {
  id: string;
  at: Date;
  reference: string;
  documentRef: string;
  customer: string;
  confirmedBy: string | null;
  method: string;
  purpose: string;
  purposeLabel: string;
  status: string;
  businessLine: FinanceLine;
  resolution: LineResolution;
  atelierKind: AtelierKind;
  currency: string;
  amountNGN: number;
  originalAmount: number | null;
  fxRateLocked: number | null;
  salesNGN: number;
  cashNGN: number;
  pointsNGN: number;
  shippingCollectedNGN: number;
  vatNGN: number;
  netOfVatNGN: number;
  liabilityNGN: number;
  bankBucket: string;
};

export function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export function recognisedAt(p: Pick<FinancePaymentSnap, "confirmedAt" | "createdAt">): Date {
  return p.confirmedAt ?? p.createdAt;
}

export function resolveBusinessLine(p: Pick<FinancePaymentSnap, "orderId" | "bespokeOrderId" | "invoiceId" | "consultationId">): {
  businessLine: FinanceLine;
  resolution: LineResolution;
  atelierKind: AtelierKind;
} {
  const rtw = Boolean(p.orderId);
  const consult = Boolean(p.consultationId);
  const atelierGarment = Boolean(p.bespokeOrderId || p.invoiceId);
  const atelier = consult || atelierGarment;
  if (rtw && atelier) return { businessLine: "UNASSIGNED", resolution: "both", atelierKind: null };
  if (!rtw && !atelier) return { businessLine: "UNASSIGNED", resolution: "neither", atelierKind: null };
  if (rtw) return { businessLine: "RTW", resolution: "rtw", atelierKind: null };
  const atelierKind: AtelierKind = consult ? "consultation" : p.invoiceId && !p.bespokeOrderId ? "invoice" : "commission";
  return { businessLine: "ATELIER", resolution: "atelier", atelierKind };
}

export function purposeLabel(purpose: string, atelierKind: AtelierKind): string {
  if (purpose === PaymentPurpose.POINTS_REDEMPTION) return "Points";
  if (purpose === PaymentPurpose.CONSULTATION || atelierKind === "consultation") return "Consultation";
  if (purpose === PaymentPurpose.DEPOSIT) return "Deposit";
  if (purpose === PaymentPurpose.BALANCE) return "Balance";
  if (purpose === PaymentPurpose.FULL) return "Full";
  if (purpose === PaymentPurpose.RTW_ORDER) return "Ready-to-wear";
  if (atelierKind === "invoice") return "Invoice";
  return purpose;
}

export function isConfirmedMoney(status: string): boolean {
  return status === PaymentStatus.CONFIRMED || status === PaymentStatus.PAID;
}

export function isPointsRow(p: Pick<FinancePaymentSnap, "method" | "purpose">): boolean {
  return p.method === PaymentMethod.POINTS || p.purpose === PaymentPurpose.POINTS_REDEMPTION;
}

/** Cash received against an obligation until the refund stamp is set. */
export function isOversellLiability(order: FinanceOrderSnap | null): boolean {
  if (!order) return false;
  return order.paymentStatus === PaymentStatus.PAID && order.status === "CANCELLED" && order.refundRecordedAt == null;
}

function amountToNGN(p: FinancePaymentSnap): { amountNGN: number; originalAmount: number | null; fxRateLocked: number | null } {
  const amount = p.amount;
  const cur = (p.currency || "NGN").toUpperCase();
  if (p.orderId) {
    const rate = p.order?.fxRateLocked ?? null;
    const gbp = p.order?.fxGbpRateLocked ?? null;
    let original: number | null = null;
    if (cur === "USD" && rate && rate > 0) original = money(amount * rate);
    else if (cur === "GBP" && gbp && gbp > 0) original = money(amount * gbp);
    return { amountNGN: money(amount), originalAmount: original, fxRateLocked: rate };
  }
  if (cur === "NGN" || !cur) return { amountNGN: money(amount), originalAmount: null, fxRateLocked: null };
  const invRate = p.invoice?.exchangeRate ?? 1;
  if (invRate > 0 && invRate !== 1) {
    return { amountNGN: money(amount * invRate), originalAmount: money(amount), fxRateLocked: invRate };
  }
  return { amountNGN: money(amount), originalAmount: money(amount), fxRateLocked: null };
}

function vatOnPayment(p: FinancePaymentSnap, amountNGN: number): number {
  const inv = p.invoice;
  if (!inv?.vatEnabled || inv.vatAmount <= 0 || inv.total <= 0) return 0;
  return money(amountNGN * (inv.vatAmount / inv.total));
}

function documentRef(p: FinancePaymentSnap): string {
  if (p.order?.orderNumber) return p.order.orderNumber;
  if (p.bespokeRef) return p.bespokeRef;
  if (p.invoice?.invoiceNumber) return p.invoice.invoiceNumber;
  if (p.consultationRef) return p.consultationRef;
  return p.reference;
}

function bankBucket(p: FinancePaymentSnap, line: FinanceLine): string {
  if (p.method === PaymentMethod.BANK_TRANSFER || p.method === PaymentMethod.MANUAL) {
    const cur = (p.currency || "NGN").toUpperCase();
    const bl = line === "ATELIER" ? "ATELIER" : "RTW";
    return `Bank · ${cur} · ${bl}`;
  }
  if (p.method === PaymentMethod.POINTS) return "Points (not in a bank)";
  return p.method;
}

function rtwShippingOnFirst(order: FinanceOrderSnap, laterRtwCashNGN: number, thisAmount: number): number {
  const later = Math.max(0, laterRtwCashNGN);
  const checkoutShipping = Math.max(0, money(order.shippingAmount - later));
  return money(Math.min(thisAmount, checkoutShipping));
}

export function classifyPayments(rows: FinancePaymentSnap[]): ClassifiedLine[] {
  const laterCash = new Map<string, number>();
  const firstCashId = new Map<string, string>();
  const rtwCash = rows
    .filter((p) => p.orderId && isConfirmedMoney(p.status) && !isPointsRow(p) && p.purpose === PaymentPurpose.RTW_ORDER)
    .sort((a, b) => recognisedAt(a).getTime() - recognisedAt(b).getTime() || a.id.localeCompare(b.id));
  for (const p of rtwCash) {
    const oid = p.orderId!;
    if (!firstCashId.has(oid)) {
      firstCashId.set(oid, p.id);
    } else {
      laterCash.set(oid, money((laterCash.get(oid) ?? 0) + amountToNGN(p).amountNGN));
    }
  }

  return rows
    .slice()
    .sort((a, b) => recognisedAt(a).getTime() - recognisedAt(b).getTime() || a.reference.localeCompare(b.reference))
    .map((p) => {
      const { businessLine, resolution, atelierKind } = resolveBusinessLine(p);
      const { amountNGN, originalAmount, fxRateLocked } = amountToNGN(p);
      const at = recognisedAt(p);
      const confirmed = isConfirmedMoney(p.status);
      const points = isPointsRow(p);
      const liability = confirmed && isOversellLiability(p.order);
      const vatNGN = confirmed && !points && !liability ? vatOnPayment(p, amountNGN) : 0;

      let salesNGN = 0;
      let cashNGN = 0;
      let pointsNGN = 0;
      let shippingCollectedNGN = 0;
      let liabilityNGN = 0;

      if (confirmed && p.status !== PaymentStatus.REJECTED) {
        if (liability) {
          liabilityNGN = amountNGN;
        } else if (p.order?.status === "CANCELLED" && p.order.paymentStatus === PaymentStatus.PAID) {
          // Refund stamp set: the original row stays on the ledger, but it is not a sale.
        } else if (points) {
          pointsNGN = amountNGN;
          salesNGN = amountNGN;
        } else {
          cashNGN = amountNGN;
          if (p.order && p.purpose === PaymentPurpose.RTW_ORDER) {
            const later = laterCash.get(p.orderId!) ?? 0;
            const isFirst = firstCashId.get(p.orderId!) === p.id;
            shippingCollectedNGN = isFirst ? rtwShippingOnFirst(p.order, later, amountNGN) : amountNGN;
            salesNGN = money(Math.max(0, amountNGN - shippingCollectedNGN));
          } else {
            salesNGN = money(Math.max(0, amountNGN - vatNGN));
          }
        }
      }

      return {
        id: p.id,
        at,
        reference: p.reference,
        documentRef: documentRef(p),
        customer: p.clientLabel,
        confirmedBy: p.confirmedByName,
        method: p.method,
        purpose: p.purpose,
        purposeLabel: purposeLabel(p.purpose, atelierKind),
        status: p.status,
        businessLine,
        resolution,
        atelierKind,
        currency: (p.currency || "NGN").toUpperCase(),
        amountNGN,
        originalAmount,
        fxRateLocked,
        salesNGN,
        cashNGN,
        pointsNGN,
        shippingCollectedNGN,
        vatNGN,
        netOfVatNGN: money(amountNGN - vatNGN),
        liabilityNGN,
        bankBucket: bankBucket(p, businessLine),
      };
    });
}

export type LineTotals = {
  salesNGN: number;
  cashNGN: number;
  pointsNGN: number;
  shippingCollectedNGN: number;
  vatNGN: number;
  liabilityNGN: number;
  shippingPaidNGN: number;
};

export function emptyTotals(): LineTotals {
  return {
    salesNGN: 0,
    cashNGN: 0,
    pointsNGN: 0,
    shippingCollectedNGN: 0,
    vatNGN: 0,
    liabilityNGN: 0,
    shippingPaidNGN: 0,
  };
}

export function addTotals(a: LineTotals, b: LineTotals): LineTotals {
  return {
    salesNGN: money(a.salesNGN + b.salesNGN),
    cashNGN: money(a.cashNGN + b.cashNGN),
    pointsNGN: money(a.pointsNGN + b.pointsNGN),
    shippingCollectedNGN: money(a.shippingCollectedNGN + b.shippingCollectedNGN),
    vatNGN: money(a.vatNGN + b.vatNGN),
    liabilityNGN: money(a.liabilityNGN + b.liabilityNGN),
    shippingPaidNGN: money(a.shippingPaidNGN + b.shippingPaidNGN),
  };
}

export function totalsFor(lines: ClassifiedLine[], line?: FinanceLine): LineTotals {
  const t = emptyTotals();
  for (const row of lines) {
    if (line && row.businessLine !== line) continue;
    if (row.businessLine === "UNASSIGNED" && line) continue;
    t.salesNGN = money(t.salesNGN + row.salesNGN);
    t.cashNGN = money(t.cashNGN + row.cashNGN);
    t.pointsNGN = money(t.pointsNGN + row.pointsNGN);
    t.shippingCollectedNGN = money(t.shippingCollectedNGN + row.shippingCollectedNGN);
    t.vatNGN = money(t.vatNGN + row.vatNGN);
    t.liabilityNGN = money(t.liabilityNGN + row.liabilityNGN);
  }
  return t;
}

export function combinedTotals(lines: ClassifiedLine[]): LineTotals {
  return addTotals(totalsFor(lines, "RTW"), totalsFor(lines, "ATELIER"));
}
