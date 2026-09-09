import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBankDetails, getInvoiceSettings, parseInvoiceLineItems } from "@/lib/invoice";
import { remainingDepositNGN } from "@/lib/atelier-fx";
import { getOrderPaymentSummary, toNumber } from "@/lib/payments/ledger";
import {
  asPublicInvoiceCurrency,
  pieceLabelFromLineItems,
  type PublicInvoiceViewPayload,
} from "@/lib/public-invoice-payload";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const inv = await prisma.invoice.findUnique({
    where: { publicToken: token },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const nextViewedAt = inv.viewedAt ?? now;

  const data: Prisma.InvoiceUpdateInput = {
    viewCount: { increment: 1 },
    viewedAt: nextViewedAt,
  };

  let status = inv.status;

  if (inv.status === InvoiceStatus.SENT) {
    data.status = InvoiceStatus.VIEWED;
    status = InvoiceStatus.VIEWED;
  }

  if (
    inv.dueDate &&
    inv.balanceDue > 0 &&
    new Date(inv.dueDate) < now &&
    (status === InvoiceStatus.SENT || status === InvoiceStatus.VIEWED || status === InvoiceStatus.PARTIALLY_PAID)
  ) {
    data.status = InvoiceStatus.OVERDUE;
    status = InvoiceStatus.OVERDUE;
  }

  await prisma.invoice.update({
    where: { id: inv.id },
    data,
  });

  const cur = asPublicInvoiceCurrency(inv.currency);
  const [businessDetails, bankDetails] = await Promise.all([
    getInvoiceSettings(),
    getBankDetails(cur),
  ]);

  const order = inv.quotationId
    ? await prisma.bespokeOrder.findFirst({
        where: { quotationId: inv.quotationId },
        select: {
          id: true,
          orderRef: true,
          balance: true,
          fxRateLocked: true,
          fxGbpRateLocked: true,
        },
      })
    : null;

  let remainingBalanceNGN = 0;
  let depositRequiredNGN = 0;
  let confirmedNGN = 0;
  if (order) {
    const summary = await getOrderPaymentSummary(order.id);
    remainingBalanceNGN = toNumber(summary.balance);
    depositRequiredNGN = toNumber(summary.depositRequired);
    confirmedNGN = toNumber(summary.confirmed);
  }

  const payableStatuses: InvoiceStatus[] = [
    InvoiceStatus.SENT,
    InvoiceStatus.VIEWED,
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.OVERDUE,
  ];
  const pieceLabel = pieceLabelFromLineItems(inv.lineItems);
  const payload: PublicInvoiceViewPayload = {
    invoiceNumber: inv.invoiceNumber,
    currency: inv.currency,
    status,
    lineItems: parseInvoiceLineItems(inv.lineItems),
    subtotal: inv.subtotal,
    discountAmount: inv.discountAmount,
    vatEnabled: inv.vatEnabled,
    vatPercent: inv.vatPercent,
    vatAmount: inv.vatAmount,
    total: inv.total,
    depositRequired: inv.depositRequired,
    depositPaid: inv.depositPaid,
    balanceDue: inv.balanceDue,
    paymentTerms: inv.paymentTerms,
    dueDate: inv.dueDate?.toISOString() ?? null,
    paidAt: inv.paidAt?.toISOString() ?? null,
    clientNote: inv.clientNote,
    showVat: inv.showVat,
    createdAt: inv.createdAt.toISOString(),
    addresseeName: inv.clientName,
    pieceLabel,
    businessDetails,
    bankDetails,
    pay: {
      canPay: Boolean(order && remainingBalanceNGN > 0 && payableStatuses.includes(status)),
      remainingDepositNGN: remainingDepositNGN({ depositRequiredNGN, confirmedNGN }),
      remainingBalanceNGN,
      depositRequiredNGN,
      confirmedNGN,
      orderId: order?.id ?? null,
      orderRef: order?.orderRef ?? null,
      pieceLabel,
      fxRateLocked: order?.fxRateLocked ?? null,
      fxGbpRateLocked: order?.fxGbpRateLocked ?? null,
    },
  };

  return NextResponse.json(payload);
}
