import {
  InvoiceStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  type Payment,
  type PaymentGateway,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

export type PaymentSummary = {
  total: Prisma.Decimal;
  confirmed: Prisma.Decimal;
  pending: Prisma.Decimal;
  /** total − confirmed (pending does NOT reduce balance) */
  balance: Prisma.Decimal;
  depositRequired: Prisma.Decimal;
  depositSatisfied: boolean;
  isFullyPaid: boolean;
};

const D = Prisma.Decimal;
const ZERO = new D(0);

export function dec(n: number | string | Prisma.Decimal): Prisma.Decimal {
  return n instanceof D ? n : new D(n);
}

export function toNumber(d: Prisma.Decimal): number {
  return Number(d.toFixed(2));
}

export function gatewayToPaymentMethod(gateway: PaymentGateway | null | undefined): PaymentMethod {
  switch (gateway) {
    case "PAYSTACK":
      return PaymentMethod.PAYSTACK;
    case "FLUTTERWAVE":
      return PaymentMethod.FLUTTERWAVE;
    case "STRIPE":
      return PaymentMethod.STRIPE;
    case "MONNIFY":
      return PaymentMethod.MONNIFY;
    case "BANK_TRANSFER":
      return PaymentMethod.BANK_TRANSFER;
    default:
      return PaymentMethod.MANUAL;
  }
}

/** CMS-managed atelier deposit % (default 70). RTW is unaffected. */
export async function getBespokeDepositPercent(): Promise<number> {
  const raw = await getSetting("bespoke_deposit_percent");
  const n = raw != null ? Number.parseFloat(raw) : 70;
  if (!Number.isFinite(n) || n < 0 || n > 100) return 70;
  return n;
}

export function buildDepositPaymentTerms(params: {
  total: number;
  depositPercent: number;
  currency?: string;
}): string {
  const pct = params.depositPercent;
  const total = params.total;
  const deposit = Math.round(total * (pct / 100) * 100) / 100;
  const balance = Math.round((total - deposit) * 100) / 100;
  const fmt = (n: number) =>
    params.currency === "USD"
      ? `$${n.toLocaleString("en-US")}`
      : params.currency === "GBP"
        ? `£${n.toLocaleString("en-GB")}`
        : `₦${n.toLocaleString("en-NG")}`;

  return `PAYMENT TERMS\n\nOption A: ${pct}% Deposit\nPay ${fmt(deposit)} now to begin production.\nRemaining ${fmt(balance)} due before delivery.\n\nOption B: Full Payment\nPay ${fmt(total)} in full.`;
}

function sumAmounts(rows: { amount: Prisma.Decimal }[]): Prisma.Decimal {
  return rows.reduce((acc, r) => acc.plus(r.amount), ZERO);
}

function buildSummary(params: {
  total: Prisma.Decimal;
  confirmed: Prisma.Decimal;
  pending: Prisma.Decimal;
  depositRequired: Prisma.Decimal;
}): PaymentSummary {
  const balance = Prisma.Decimal.max(ZERO, params.total.minus(params.confirmed));
  const depositSatisfied =
    params.depositRequired.lte(ZERO) || params.confirmed.gte(params.depositRequired);
  const isFullyPaid = params.confirmed.gte(params.total) && params.total.gt(ZERO);
  return {
    total: params.total,
    confirmed: params.confirmed,
    pending: params.pending,
    balance,
    depositRequired: params.depositRequired,
    depositSatisfied,
    isFullyPaid,
  };
}

async function resolveOrderDepositRequired(
  bespokeOrderId: string,
  total: Prisma.Decimal,
): Promise<Prisma.Decimal> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: bespokeOrderId },
    select: { quotationId: true },
  });
  if (order?.quotationId) {
    const invoice = await prisma.invoice.findFirst({
      where: { quotationId: order.quotationId },
      orderBy: { createdAt: "desc" },
      select: { depositRequired: true },
    });
    if (invoice && invoice.depositRequired > 0) {
      return dec(invoice.depositRequired);
    }
  }
  const pct = await getBespokeDepositPercent();
  return total.mul(pct).div(100).toDecimalPlaces(2);
}

/**
 * Authoritative payment summary for a bespoke order.
 * Balance is derived from Payment rows — never from BespokeOrder.amountPaid.
 */
export async function getOrderPaymentSummary(bespokeOrderId: string): Promise<PaymentSummary> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: bespokeOrderId },
    select: { id: true, totalAmount: true },
  });
  if (!order) {
    throw new Error(`BespokeOrder not found: ${bespokeOrderId}`);
  }

  const total = dec(order.totalAmount);
  const depositRequired = await resolveOrderDepositRequired(bespokeOrderId, total);

  const [confirmedRows, pendingRows] = await Promise.all([
    prisma.payment.findMany({
      where: { bespokeOrderId, status: PaymentStatus.CONFIRMED },
      select: { amount: true },
    }),
    prisma.payment.findMany({
      where: { bespokeOrderId, status: PaymentStatus.PENDING },
      select: { amount: true },
    }),
  ]);

  return buildSummary({
    total,
    confirmed: sumAmounts(confirmedRows),
    pending: sumAmounts(pendingRows),
    depositRequired,
  });
}

/**
 * Authoritative payment summary for an invoice.
 * Confirmed total comes from Payment rows, not Invoice.depositPaid.
 */
export async function getInvoicePaymentSummary(invoiceId: string): Promise<PaymentSummary> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, total: true, depositRequired: true },
  });
  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  const total = dec(invoice.total);
  const depositRequired = dec(invoice.depositRequired);

  const [confirmedRows, pendingRows] = await Promise.all([
    prisma.payment.findMany({
      where: { invoiceId, status: PaymentStatus.CONFIRMED },
      select: { amount: true },
    }),
    prisma.payment.findMany({
      where: { invoiceId, status: PaymentStatus.PENDING },
      select: { amount: true },
    }),
  ]);

  return buildSummary({
    total,
    confirmed: sumAmounts(confirmedRows),
    pending: sumAmounts(pendingRows),
    depositRequired,
  });
}

async function maybeUnlockProduction(bespokeOrderId: string): Promise<void> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: bespokeOrderId },
    select: {
      id: true,
      orderRef: true,
      clientName: true,
      productionUnlockedAt: true,
    },
  });
  if (!order || order.productionUnlockedAt) return;

  const summary = await getOrderPaymentSummary(bespokeOrderId);
  // Never unlock without confirmed money (even if deposit % is 0).
  if (!summary.depositSatisfied || summary.confirmed.lte(ZERO)) {
    return;
  }

  const earliest = await prisma.payment.findFirst({
    where: { bespokeOrderId, status: PaymentStatus.CONFIRMED },
    orderBy: { confirmedAt: "asc" },
    select: { confirmedAt: true, createdAt: true },
  });
  if (!earliest) return;
  const unlockedAt = earliest.confirmedAt ?? earliest.createdAt;

  await prisma.bespokeOrder.update({
    where: { id: bespokeOrderId },
    data: { productionUnlockedAt: unlockedAt },
  });

  void createNotification({
    type: "NEW_BESPOKE",
    title: "Production unlocked",
    message: `${order.orderRef} — deposit satisfied for ${order.clientName}. Production may begin.`,
    link: `/admin/bespoke/${order.id}`,
    entityId: order.id,
  }).catch(() => {});
}

/**
 * Only writer allowed to set BespokeOrder.amountPaid / balance (denormalised cache).
 * Also sets productionUnlockedAt when deposit becomes satisfied.
 */
export async function recomputeOrderTotals(bespokeOrderId: string): Promise<PaymentSummary> {
  const summary = await getOrderPaymentSummary(bespokeOrderId);
  await prisma.bespokeOrder.update({
    where: { id: bespokeOrderId },
    data: {
      amountPaid: toNumber(summary.confirmed),
      balance: toNumber(summary.balance),
    },
  });
  await maybeUnlockProduction(bespokeOrderId);
  return summary;
}

/**
 * Only writer allowed to set Invoice.depositPaid / balanceDue (denormalised cache).
 */
export async function recomputeInvoiceTotals(invoiceId: string): Promise<PaymentSummary> {
  const summary = await getInvoicePaymentSummary(invoiceId);
  const confirmed = toNumber(summary.confirmed);
  const balanceDue = toNumber(summary.balance);

  let status: InvoiceStatus | undefined;
  if (summary.isFullyPaid) {
    status = InvoiceStatus.PAID;
  } else if (summary.confirmed.gt(ZERO)) {
    status = InvoiceStatus.PARTIALLY_PAID;
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      depositPaid: confirmed,
      balanceDue,
      ...(status
        ? {
            status,
            paidAt: status === InvoiceStatus.PAID ? new Date() : undefined,
          }
        : {}),
    },
  });

  return summary;
}

export type CreatePaymentInput = {
  reference: string;
  amount: number | string | Prisma.Decimal;
  currency?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  purpose: PaymentPurpose;
  receiptUrl?: string | null;
  gatewayPayload?: Prisma.InputJsonValue;
  invoiceId?: string | null;
  bespokeOrderId?: string | null;
  consultationId?: string | null;
  orderId?: string | null;
  clientId: string;
  confirmedById?: string | null;
  confirmedAt?: Date | null;
  rejectedReason?: string | null;
  createdAt?: Date;
};

/**
 * Append a Payment row. Never mutates amount on an existing row —
 * pass a new reference for corrections / refunds.
 */
export async function appendPayment(input: CreatePaymentInput): Promise<Payment> {
  const amount = dec(input.amount);
  if (amount.isZero()) {
    throw new Error("Payment amount must be non-zero");
  }

  const payment = await prisma.payment.create({
    data: {
      reference: input.reference,
      amount,
      currency: input.currency ?? "NGN",
      method: input.method,
      status: input.status,
      purpose: input.purpose,
      receiptUrl: input.receiptUrl ?? null,
      gatewayPayload: input.gatewayPayload ?? undefined,
      invoiceId: input.invoiceId ?? null,
      bespokeOrderId: input.bespokeOrderId ?? null,
      consultationId: input.consultationId ?? null,
      orderId: input.orderId ?? null,
      clientId: input.clientId,
      confirmedById: input.confirmedById ?? null,
      confirmedAt: input.confirmedAt ?? (input.status === PaymentStatus.CONFIRMED ? new Date() : null),
      rejectedReason: input.rejectedReason ?? null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });

  if (payment.bespokeOrderId) {
    await recomputeOrderTotals(payment.bespokeOrderId);
  }
  if (payment.invoiceId) {
    await recomputeInvoiceTotals(payment.invoiceId);
  }

  return payment;
}

/** Confirm a PENDING Payment (status-only update — amount is never changed). */
export async function confirmPayment(params: {
  paymentId: string;
  confirmedById?: string | null;
}): Promise<Payment> {
  const existing = await prisma.payment.findUnique({ where: { id: params.paymentId } });
  if (!existing) throw new Error("Payment not found");
  if (existing.status === PaymentStatus.CONFIRMED) return existing;
  if (existing.status !== PaymentStatus.PENDING) {
    throw new Error(`Cannot confirm payment in status ${existing.status}`);
  }

  const payment = await prisma.payment.update({
    where: { id: params.paymentId },
    data: {
      status: PaymentStatus.CONFIRMED,
      confirmedAt: new Date(),
      confirmedById: params.confirmedById ?? null,
      rejectedReason: null,
    },
  });

  if (payment.bespokeOrderId) await recomputeOrderTotals(payment.bespokeOrderId);
  if (payment.invoiceId) await recomputeInvoiceTotals(payment.invoiceId);

  return payment;
}

/** Reject a PENDING Payment (status-only — amount unchanged). */
export async function rejectPayment(params: {
  paymentId: string;
  reason: string;
  confirmedById?: string | null;
}): Promise<Payment> {
  const existing = await prisma.payment.findUnique({ where: { id: params.paymentId } });
  if (!existing) throw new Error("Payment not found");
  if (existing.status === PaymentStatus.REJECTED) return existing;
  if (existing.status !== PaymentStatus.PENDING) {
    throw new Error(`Cannot reject payment in status ${existing.status}`);
  }

  const payment = await prisma.payment.update({
    where: { id: params.paymentId },
    data: {
      status: PaymentStatus.REJECTED,
      rejectedReason: params.reason,
      confirmedById: params.confirmedById ?? null,
      confirmedAt: null,
    },
  });

  if (payment.bespokeOrderId) await recomputeOrderTotals(payment.bespokeOrderId);
  if (payment.invoiceId) await recomputeInvoiceTotals(payment.invoiceId);

  return payment;
}

export function inferBespokePurpose(params: {
  amount: number;
  balanceBefore: number;
  depositRequired: number;
  confirmedBefore: number;
}): PaymentPurpose {
  if (params.amount >= params.balanceBefore - 0.01) return PaymentPurpose.FULL;
  if (params.confirmedBefore + params.amount + 0.01 >= params.depositRequired && params.confirmedBefore < params.depositRequired) {
    return PaymentPurpose.DEPOSIT;
  }
  if (params.confirmedBefore >= params.depositRequired) return PaymentPurpose.BALANCE;
  return PaymentPurpose.DEPOSIT;
}

/** Resolve a stable clientId for ledger rows (User.id preferred). */
export async function resolveClientId(params: {
  userId?: string | null;
  email?: string | null;
}): Promise<string> {
  if (params.userId) return params.userId;
  if (params.email) {
    const user = await prisma.user.findUnique({
      where: { email: params.email.toLowerCase() },
      select: { id: true },
    });
    if (user) return user.id;
    return `email:${params.email.toLowerCase()}`;
  }
  return "unknown";
}

/**
 * Read-side counterpart to `resolveClientId`.
 *
 * A payment written while the client was a guest carries `email:<lowercase>`.
 * If that person later registers, their newer payments carry `User.id`. The
 * append-only trigger makes `clientId` immutable, so the old rows keep the
 * placeholder forever — reading by a single identifier would silently hide a
 * client's own payment history from them.
 *
 * Every client-scoped payment query must therefore filter on
 * `clientId: { in: await resolveClientIdentifiers(...) }`.
 */
export async function resolveClientIdentifiers(params: {
  userId?: string | null;
  email?: string | null;
}): Promise<string[]> {
  const ids = new Set<string>();
  if (params.userId) ids.add(params.userId);

  const email = params.email?.toLowerCase().trim();
  if (email) {
    ids.add(`email:${email}`);
    if (!params.userId) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user) ids.add(user.id);
    }
  } else if (params.userId) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true },
    });
    if (user?.email) ids.add(`email:${user.email.toLowerCase()}`);
  }

  return Array.from(ids);
}

/** All ledger rows belonging to a client, across guest and registered identities. */
export async function getClientPayments(params: {
  userId?: string | null;
  email?: string | null;
  statuses?: PaymentStatus[];
}) {
  const clientIds = await resolveClientIdentifiers(params);
  if (clientIds.length === 0) return [];
  return prisma.payment.findMany({
    where: {
      clientId: { in: clientIds },
      ...(params.statuses ? { status: { in: params.statuses } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}
