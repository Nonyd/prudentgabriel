/**
 * Slice AC8 — cascade consultation delete.
 *
 * Dependency list (every row that would otherwise orphan a ConsultationBooking):
 *
 * Restrict — must delete or refuse before the booking:
 *   Payment.consultationId (RESTRICT + append-only trigger — same app.ledger_bypass)
 *
 * SetNull if we deleted blindly (we do not, for commissions/invoices):
 *   Quotation.consultationId
 *   Invoice.consultationId
 *   BespokeOrder.consultationId
 *   Review.consultationId
 *
 * On the booking itself (columns, not child tables):
 *   sessionNotes, moodboardNotes, moodboardImages[], referenceImages[], paymentReceiptUrl
 *
 * Downstream of Quotation (not deleted from here if a commission exists):
 *   BespokeOrder, Invoice, StageApproval, OrderStageCompletion, OrderStageMedia,
 *   OrderStageDraft, StageUpdate, OrderAssignment, Material, AlterationRequest
 *
 * Policy:
 *   Quiet — no Payment row, no Quotation, no Invoice, no BespokeOrder.
 *   Loud  — a consultation fee Payment exists, and/or a quotation exists that has
 *           not been converted. SUPER_ADMIN + typed DELETE. Quotations without
 *           orders/invoices are removed with the booking.
 *   Blocked — any BespokeOrder or Invoice is linked (directly or via quotation).
 *           A commission in progress is not deletable from consultations.
 *
 * Never deleted: ClientProfile, User, Consultant, ConsultantOffering.
 *
 * After commit: referenceImages, moodboardImages, paymentReceiptUrl, Payment.receiptUrl.
 */

import { ActivityAction, PaymentMethod, PaymentStatus, Prisma, QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CASCADE_CONFIRMATION, formatReceivedNGN, type CascadePaymentSnap } from "@/lib/cascade-copy";
import {
  enableLedgerBypass,
  ProductCascadeError,
  type CascadeActor,
} from "@/lib/product-cascade-delete";
import {
  CONSULTATION_CASCADE_MODULE,
  CONSULTATION_CASCADE_RECORD_TYPE,
  consultationDialogCopy,
  type ConsultationCascadeBookingSnap,
  type ConsultationCascadePreview,
  type ConsultationCascadeSnapshot,
} from "@/lib/consultation-cascade-copy";

export {
  CONSULTATION_CASCADE_MODULE,
  CONSULTATION_CASCADE_RECORD_TYPE,
  consultationDialogCopy,
};
export type { ConsultationCascadePreview, ConsultationCascadeSnapshot };

export const CONSULTATION_CASCADE_DEPENDENCIES = [
  "Payment",
  "Quotation",
  "Invoice (blocked, not deleted)",
  "BespokeOrder (blocked, not deleted)",
  "StageApproval (via BespokeOrder — blocked)",
  "Review",
  "sessionNotes / moodboardNotes / moodboardImages / referenceImages",
  "paymentReceiptUrl / Payment.receiptUrl (files after commit)",
  "ClientProfile (never)",
] as const;

const MAX = 50;

function money(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function isConfirmedMoney(status: PaymentStatus): boolean {
  return status === PaymentStatus.CONFIRMED || status === PaymentStatus.PAID;
}

function cashReceived(payments: { amount: Prisma.Decimal | number; status: PaymentStatus; method: PaymentMethod }[]): number {
  return money(
    payments
      .filter((p) => isConfirmedMoney(p.status) && p.method !== PaymentMethod.POINTS)
      .reduce((s, p) => s + Number(p.amount), 0),
  );
}

export type ConsultationCascadePlan = ConsultationCascadePreview & {
  bookingIds: string[];
  quotationIds: string[];
};

export async function previewConsultationCascade(ids: string[]): Promise<ConsultationCascadePreview> {
  return loadConsultationPlan(ids);
}

export async function loadConsultationPlan(ids: string[]): Promise<ConsultationCascadePlan> {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) {
    throw new ProductCascadeError("EMPTY", "Select at least one consultation", 400);
  }
  if (unique.length > MAX) {
    throw new ProductCascadeError("TOO_MANY", `Maximum ${MAX} consultations per request`, 400);
  }

  const bookings = await prisma.consultationBooking.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      bookingNumber: true,
      clientName: true,
      clientEmail: true,
      offeringType: true,
      confirmedDate: true,
      createdAt: true,
      feeNGN: true,
      paymentReceiptUrl: true,
      referenceImages: true,
      moodboardImages: true,
      quotations: {
        select: {
          id: true,
          quoteRef: true,
          status: true,
          invoices: { select: { id: true, invoiceNumber: true } },
          bespokeOrders: { select: { id: true, orderRef: true } },
        },
      },
      invoices: { select: { id: true, invoiceNumber: true } },
      bespokeOrders: { select: { id: true, orderRef: true } },
      payments: {
        select: {
          reference: true,
          method: true,
          status: true,
          amount: true,
          confirmedAt: true,
          createdAt: true,
          receiptUrl: true,
        },
      },
    },
  });
  if (bookings.length === 0) {
    throw new ProductCascadeError("NOT_FOUND", "Consultation not found", 404);
  }

  const bookingIds = bookings.map((b) => b.id);
  const quotationIds = bookings.flatMap((b) => b.quotations.map((q) => q.id));
  const quotationRefs = Array.from(new Set(bookings.flatMap((b) => b.quotations.map((q) => q.quoteRef))));
  const commissionRefs = Array.from(
    new Set(
      bookings.flatMap((b) => [
        ...b.bespokeOrders.map((o) => o.orderRef),
        ...b.quotations.flatMap((q) => q.bespokeOrders.map((o) => o.orderRef)),
      ]),
    ),
  );
  const invoiceRefs = Array.from(
    new Set(
      bookings.flatMap((b) => [
        ...b.invoices.map((i) => i.invoiceNumber),
        ...b.quotations.flatMap((q) => q.invoices.map((i) => i.invoiceNumber)),
      ]),
    ),
  );
  const converted = bookings.some((b) => b.quotations.some((q) => q.status === QuoteStatus.CONVERTED));
  const blocked = commissionRefs.length > 0 || invoiceRefs.length > 0 || converted;

  const paymentRows: CascadePaymentSnap[] = bookings.flatMap((b) =>
    b.payments.map((p) => ({
      reference: p.reference,
      method: p.method,
      status: p.status,
      amountNGN: money(Number(p.amount)),
      at: (p.confirmedAt ?? p.createdAt).toISOString(),
      orderNumber: b.bookingNumber,
    })),
  );
  const receivedNGN = money(
    bookings.reduce((s, b) => s + cashReceived(b.payments), 0),
  );
  const loud = !blocked && (paymentRows.length > 0 || quotationIds.length > 0);

  const snaps: ConsultationCascadeBookingSnap[] = bookings.map((b) => ({
    id: b.id,
    bookingNumber: b.bookingNumber,
    clientName: b.clientName,
    clientEmail: b.clientEmail,
    type: b.offeringType,
    date: (b.confirmedDate ?? b.createdAt).toISOString(),
    feeNGN: money(b.feeNGN),
    feePaidNGN: cashReceived(b.payments),
    quotationRefs: b.quotations.map((q) => q.quoteRef),
  }));

  const mediaUrls = Array.from(
    new Set(
      bookings.flatMap((b) => [
        ...b.referenceImages,
        ...b.moodboardImages,
        b.paymentReceiptUrl,
        ...b.payments.map((p) => p.receiptUrl),
      ]).filter((u): u is string => Boolean(u)),
    ),
  );

  let blockReason: string | null = null;
  if (blocked) {
    if (commissionRefs.length > 0) {
      blockReason = `This consultation produced ${commissionRefs.length === 1 ? "commission" : "commissions"} ${joinNamedListSafe(commissionRefs)}.`;
    } else if (invoiceRefs.length > 0) {
      blockReason = `This consultation has ${invoiceRefs.length === 1 ? "invoice" : "invoices"} ${joinNamedListSafe(invoiceRefs)}.`;
    } else {
      blockReason = "This consultation produced a converted quotation.";
    }
  }

  return {
    loud,
    blocked,
    blockReason,
    bookingCount: bookings.length,
    bookings: snaps,
    payments: paymentRows,
    quotationRefs,
    commissionRefs,
    invoiceRefs,
    receivedNGN,
    mediaUrls,
    bookingIds,
    quotationIds,
  };
}

function joinNamedListSafe(names: string[]): string {
  if (names.length <= 8) return names.join(", ");
  return `${names.slice(0, 8).join(", ")}, and ${names.length - 8} more`;
}

export async function executeConsultationCascade(opts: {
  ids: string[];
  actor: CascadeActor;
  confirmation?: string;
  injectFailure?: "after-graph";
}): Promise<{ logId: string; mediaUrls: string[]; deletedIds: string[]; loud: boolean }> {
  const plan = await loadConsultationPlan(opts.ids);
  if (plan.blocked) {
    throw new ProductCascadeError("BLOCKED", plan.blockReason ?? "This consultation cannot be deleted from here", 409);
  }
  if (plan.loud && opts.actor.role !== "SUPER_ADMIN") {
    throw new ProductCascadeError(
      "FORBIDDEN",
      "Only a Super Admin can delete a consultation that was paid or produced a quotation",
      403,
    );
  }
  if (plan.loud && opts.confirmation !== CASCADE_CONFIRMATION) {
    throw new ProductCascadeError(
      "CONFIRM",
      `Type ${CASCADE_CONFIRMATION} to delete a consultation that was paid or produced a quotation`,
      400,
    );
  }

  try {
    const logId = await prisma.$transaction(
      async (tx) => {
        await enableLedgerBypass(tx);
        if (plan.bookingIds.length > 0) {
          await tx.payment.deleteMany({ where: { consultationId: { in: plan.bookingIds } } });
        }
        await tx.review.deleteMany({ where: { consultationId: { in: plan.bookingIds } } });
        if (plan.quotationIds.length > 0) {
          await tx.quotation.deleteMany({ where: { id: { in: plan.quotationIds } } });
        }
        await tx.consultationBooking.deleteMany({ where: { id: { in: plan.bookingIds } } });
        if (opts.injectFailure === "after-graph") {
          throw new Error("injected cascade failure");
        }
        return writeConsultationLog(tx, plan, opts.actor);
      },
      { timeout: 60_000, maxWait: 15_000 },
    );
    return { logId, mediaUrls: plan.mediaUrls, deletedIds: plan.bookingIds, loud: plan.loud };
  } catch (e) {
    if (e instanceof ProductCascadeError) throw e;
    if (e instanceof Error && e.message === "injected cascade failure") throw e;
    throw new ProductCascadeError("FAILED", "Delete failed; nothing was removed", 500);
  }
}

async function writeConsultationLog(
  tx: Prisma.TransactionClient,
  plan: ConsultationCascadePlan,
  actor: CascadeActor,
): Promise<string> {
  const snapshot: ConsultationCascadeSnapshot = {
    kind: CONSULTATION_CASCADE_RECORD_TYPE,
    bookings: plan.bookings,
    payments: plan.payments,
    quotationRefs: plan.quotationRefs,
    receivedNGN: plan.receivedNGN,
    actor: { userId: actor.userId, email: actor.email, role: actor.role, ip: actor.ip },
  };
  const copy = consultationDialogCopy(plan);
  const description = plan.loud
    ? `Cascade deleted ${plan.bookingCount} consultations (${formatReceivedNGN(plan.receivedNGN)} received)`
    : `Deleted ${plan.bookingCount} ${plan.bookingCount === 1 ? "consultation" : "consultations"} with no payment`;

  const row = await tx.activityLog.create({
    data: {
      userId: actor.userId,
      userEmail: actor.email,
      userRole: actor.role,
      action: ActivityAction.DELETE,
      module: CONSULTATION_CASCADE_MODULE,
      description: `${description}. ${copy.heading}`,
      recordId: plan.bookingIds[0],
      recordType: CONSULTATION_CASCADE_RECORD_TYPE,
      ipAddress: actor.ip,
      snapshot: snapshot as Prisma.InputJsonValue,
    },
  });
  return row.id;
}
