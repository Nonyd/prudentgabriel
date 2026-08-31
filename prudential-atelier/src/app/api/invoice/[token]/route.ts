import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBankDetails, getInvoiceSettings, parseInvoiceLineItems } from "@/lib/invoice";
import type { InvoiceCurrency, PublicInvoicePayload } from "@/types/invoice";

function asCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP" || c === "EUR") return c;
  return "NGN";
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const inv = await prisma.invoice.findUnique({
    where: { publicToken: token },
    include: {
      bespokeRequest: { select: { id: true, requestNumber: true, occasion: true } },
    },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const nextViewedAt = inv.viewedAt ?? now;
  const nextViewCount = inv.viewCount + 1;

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

  const cur = asCurrency(inv.currency);
  const [businessDetails, bankDetails] = await Promise.all([
    getInvoiceSettings(),
    getBankDetails(cur),
  ]);

  const payload: PublicInvoicePayload = {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    clientEmail: inv.clientEmail,
    clientPhone: inv.clientPhone,
    clientAddress: inv.clientAddress,
    clientCity: inv.clientCity,
    clientCountry: inv.clientCountry,
    clientInstagram: inv.clientInstagram,
    currency: inv.currency,
    exchangeRate: inv.exchangeRate,
    status,
    lineItems: parseInvoiceLineItems(inv.lineItems),
    subtotal: inv.subtotal,
    discountType: inv.discountType,
    discountValue: inv.discountValue,
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
    showRcNumber: inv.showRcNumber,
    sentAt: inv.sentAt?.toISOString() ?? null,
    viewedAt: nextViewedAt.toISOString(),
    viewCount: nextViewCount,
    createdAt: inv.createdAt.toISOString(),
    bespokeRequest: inv.bespokeRequest
      ? {
          id: inv.bespokeRequest.id,
          requestNumber: inv.bespokeRequest.requestNumber,
          occasion: inv.bespokeRequest.occasion,
        }
      : null,
    businessDetails,
    bankDetails,
  };

  return NextResponse.json(payload);
}
