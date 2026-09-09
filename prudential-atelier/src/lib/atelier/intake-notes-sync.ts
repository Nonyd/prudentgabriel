import { BespokeStage, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invoiceIssuanceNote, paymentConfirmationNote } from "@/lib/atelier/intake-stages";

/**
 * Rewrite convert-time intake notes so they match the order's invoice and deposit state.
 * StageUpdate is the client timeline; OrderStageCompletion is the live completion row.
 */
export async function syncIntakeStageNotes(bespokeOrderId: string, depositSatisfied: boolean): Promise<void> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: bespokeOrderId },
    select: {
      quotationId: true,
      consultationId: true,
      quotation: { select: { quoteRef: true } },
    },
  });
  if (!order?.quotationId) return;

  const [invoice, consultation] = await Promise.all([
    prisma.invoice.findFirst({
      where: { quotationId: order.quotationId },
      orderBy: { createdAt: "desc" },
      select: { invoiceNumber: true, status: true, sentAt: true },
    }),
    order.consultationId
      ? prisma.consultationBooking.findUnique({
          where: { id: order.consultationId },
          select: { paidAt: true, paymentRef: true },
        })
      : Promise.resolve(null),
  ]);
  if (!invoice) return;

  const sent =
    Boolean(invoice.sentAt) ||
    (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.CANCELLED);
  const invoiceNote = invoiceIssuanceNote({
    invoiceNumber: invoice.invoiceNumber,
    quoteRef: order.quotation?.quoteRef ?? "",
    sent,
  });
  const paymentNote = paymentConfirmationNote({
    consultationPaid: Boolean(consultation?.paidAt || consultation?.paymentRef),
    consultationPaymentRef: consultation?.paymentRef ?? null,
    depositSatisfied,
  });

  await rewriteStageNote(bespokeOrderId, BespokeStage.INVOICE_ISSUANCE, invoiceNote);
  await rewriteStageNote(bespokeOrderId, BespokeStage.PAYMENT_CONFIRMATION, paymentNote);
}

async function rewriteStageNote(orderId: string, stage: BespokeStage, notes: string): Promise<void> {
  const latest = await prisma.stageUpdate.findFirst({
    where: { orderId, stage },
    orderBy: { completedAt: "desc" },
    select: { id: true, notes: true },
  });
  if (latest && latest.notes !== notes) {
    await prisma.stageUpdate.update({ where: { id: latest.id }, data: { notes } });
  }
  await prisma.orderStageCompletion.updateMany({
    where: { orderId, stage, revertedAt: null },
    data: { notes },
  });
}
