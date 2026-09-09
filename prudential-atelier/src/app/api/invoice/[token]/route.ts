import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBankDetails, getInvoiceSettings, parseInvoiceLineItems } from "@/lib/invoice";
import { remainingDepositNGN, ngnToDocument, lockedFxFromAtelier } from "@/lib/atelier-fx";
import { getOrderPaymentSummary, toNumber } from "@/lib/payments/ledger";
import {
  asPublicInvoiceCurrency,
  pieceLabelFromLineItems,
  type PublicInvoiceViewPayload,
} from "@/lib/public-invoice-payload";
import { getPublicPaymentConfig } from "@/lib/payments/config";
import { currenciesWithMethods, defaultPayCurrency } from "@/lib/invoice-pay-options";
import { getHouseDocumentTerms } from "@/lib/invoice-terms";
import { assembleInvoiceDocumentRender } from "@/lib/invoice-document";
import { expiredInvoiceBlocksPayment, isDocumentExpired } from "@/lib/document-validity";

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
  const [businessDetails, bankDetails, payConfig, houseTerms] = await Promise.all([
    getInvoiceSettings(),
    getBankDetails(cur),
    getPublicPaymentConfig("ATELIER"),
    getHouseDocumentTerms(),
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
  const remainingDeposit = remainingDepositNGN({ depositRequiredNGN, confirmedNGN });
  const availableCurrencies = currenciesWithMethods(payConfig.gateways);
  const payDefault = defaultPayCurrency(inv.currency, availableCurrencies);
  const fx = lockedFxFromAtelier({
    fxRateLocked: order?.fxRateLocked,
    fxGbpRateLocked: order?.fxGbpRateLocked,
  });
  const remainingBalanceDocument = ngnToDocument(remainingBalanceNGN, inv.currency, fx);
  const remainingDepositDocument = ngnToDocument(remainingDeposit, inv.currency, fx);
  const render = assembleInvoiceDocumentRender({
    currency: cur,
    expiresAt: inv.expiresAt,
    houseTerms,
    bank: bankDetails,
    depositPercent: inv.depositPercent,
    depositRequired: inv.depositRequired,
    depositPaid: inv.depositPaid,
    balanceDue: inv.balanceDue,
  });
  const expired = isDocumentExpired(inv.expiresAt);
  const canPay = Boolean(
    order &&
      remainingBalanceNGN > 0 &&
      payableStatuses.includes(status) &&
      (!expired || !expiredInvoiceBlocksPayment()),
  );
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
    depositPercent: inv.depositPercent,
    depositLabel: render.depositLabel,
    paymentTerms: inv.paymentTerms,
    dueDate: inv.dueDate?.toISOString() ?? null,
    expiresAt: inv.expiresAt?.toISOString() ?? null,
    expired,
    payInstruction: render.payInstruction,
    houseTerms: render.houseTerms,
    paidAt: inv.paidAt?.toISOString() ?? null,
    clientNote: inv.clientNote,
    showVat: inv.showVat,
    createdAt: inv.createdAt.toISOString(),
    addresseeName: inv.clientName,
    pieceLabel,
    businessDetails,
    bankDetails,
    pay: {
      canPay,
      remainingDepositNGN: remainingDeposit,
      remainingBalanceNGN,
      remainingDepositDocument,
      remainingBalanceDocument,
      depositRequiredNGN,
      confirmedNGN,
      orderId: order?.id ?? null,
      orderRef: order?.orderRef ?? null,
      pieceLabel,
      fxRateLocked: order?.fxRateLocked ?? null,
      fxGbpRateLocked: order?.fxGbpRateLocked ?? null,
      availableCurrencies,
      defaultCurrency: payDefault,
      createsAccount: true,
    },
  };

  return NextResponse.json(payload);
}
