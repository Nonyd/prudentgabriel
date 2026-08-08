import { InvoiceStatus, Prisma, QuoteStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { generateBespokeOrderRef } from "@/lib/bespoke-stages";
import { generateInvoiceNumber, calculateInvoiceTotals, syncLineItemAmounts } from "@/lib/invoice";
import {
  buildDepositPaymentTerms,
  getBespokeDepositPercent,
} from "@/lib/payments/ledger";
import type { InvoiceLineItem } from "@/types/invoice";

type QuotationRecord = {
  id: string;
  quoteRef: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  lineItems: unknown;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes: string | null;
  status: QuoteStatus;
  consultationId?: string | null;
};

async function uniqueOrderRef(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const orderRef = generateBespokeOrderRef();
    const exists = await prisma.bespokeOrder.findUnique({ where: { orderRef } });
    if (!exists) return orderRef;
  }
  return generateBespokeOrderRef();
}

function mapLineItems(raw: unknown): InvoiceLineItem[] {
  if (!Array.isArray(raw)) return [];
  return syncLineItemAmounts(
    raw
      .map((row) => {
        const r = row as {
          description?: string;
          quantity?: number;
          unitPrice?: number;
          total?: number;
        };
        const qty = Number(r.quantity) || 1;
        const unit = Number(r.unitPrice) || 0;
        return {
          id: nanoid(),
          description: String(r.description ?? "Line item"),
          quantity: qty,
          unitPrice: unit,
          amount: Number(r.total) || qty * unit,
        };
      })
      .filter((i) => i.description.trim()),
  );
}

export async function convertQuotationToOrder(
  quote: QuotationRecord,
  createdBy?: string | null,
): Promise<{ orderId: string; orderRef: string; invoiceId: string; invoiceNumber: string }> {
  if (quote.status === QuoteStatus.SUPERSEDED) {
    throw new Error("SUPERSEDED");
  }

  const existingOrder = await prisma.bespokeOrder.findFirst({
    where: { quotationId: quote.id },
  });
  if (existingOrder) {
    throw new Error("ALREADY_CONVERTED");
  }

  const clientProfile = await prisma.clientProfile.findFirst({
    where: { user: { email: quote.clientEmail } },
  });

  const depositPercent = await getBespokeDepositPercent();

  const items = mapLineItems(quote.lineItems);
  const lineItemsPayload = items.length
    ? items
    : [
        {
          id: nanoid(),
          description: quote.quoteRef,
          quantity: 1,
          unitPrice: quote.total,
          amount: quote.total,
        },
      ];
  const totals = calculateInvoiceTotals({
    lineItems: lineItemsPayload,
    discountType: quote.discount > 0 ? "FIXED" : null,
    discountValue: quote.discount,
    vatEnabled: quote.tax > 0,
    vatPercent: quote.subtotal > 0 ? Math.round((quote.tax / quote.subtotal) * 10000) / 100 : 0,
    depositPercent,
    depositPaid: 0,
  });

  const paymentTerms = buildDepositPaymentTerms({
    total: totals.total || quote.total,
    depositPercent,
    currency: "NGN",
  });

  const orderRef = await uniqueOrderRef();

  const consultation = quote.consultationId
    ? await prisma.consultationBooking.findUnique({
        where: { id: quote.consultationId },
      })
    : null;

  const result = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateInvoiceNumber(tx);
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        quotationId: quote.id,
        consultationId: quote.consultationId ?? null,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        clientPhone: quote.clientPhone,
        currency: "NGN",
        exchangeRate: 1,
        status: InvoiceStatus.DRAFT,
        lineItems: lineItemsPayload as unknown as Prisma.InputJsonValue,
        subtotal: totals.subtotal || quote.subtotal,
        discountType: quote.discount > 0 ? "FIXED" : null,
        discountValue: quote.discount,
        discountAmount: totals.discountAmount,
        vatEnabled: quote.tax > 0,
        vatPercent: quote.subtotal > 0 ? Math.round((quote.tax / quote.subtotal) * 10000) / 100 : 0,
        vatAmount: totals.vatAmount || quote.tax,
        total: totals.total || quote.total,
        depositRequired: totals.depositRequired,
        depositPaid: 0,
        balanceDue: totals.balanceDue,
        paymentTerms,
        notes: quote.notes,
        paymentHistory: [],
        createdBy: createdBy ?? null,
      },
    });

    const order = await tx.bespokeOrder.create({
      data: {
        orderRef,
        quotationId: quote.id,
        consultationId: quote.consultationId ?? null,
        clientProfileId: clientProfile?.id ?? null,
        clientName: consultation?.clientName ?? quote.clientName,
        clientEmail: consultation?.clientEmail ?? quote.clientEmail,
        clientPhone: consultation?.clientPhone ?? quote.clientPhone,
        outfitDescription: consultation?.sessionNotes ?? quote.notes,
        occasionType: consultation?.occasion ?? null,
        sessionNotes: consultation?.sessionNotes ?? null,
        moodboardImages: consultation?.moodboardImages ?? [],
        occasionDetails: consultation?.occasion ?? null,
        outfitBrief: consultation?.sessionNotes ?? null,
        totalAmount: quote.total,
        balance: quote.total,
        notes: quote.notes,
      },
    });

    await tx.quotation.update({
      where: { id: quote.id },
      data: { status: QuoteStatus.CONVERTED },
    });

    return { order, invoice };
  });

  return {
    orderId: result.order.id,
    orderRef: result.order.orderRef,
    invoiceId: result.invoice.id,
    invoiceNumber: result.invoice.invoiceNumber,
  };
}

export async function maybeAutoConvertApprovedQuote(quoteId: string): Promise<void> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: "auto_convert_approved_quotes" },
  });
  if (setting?.value !== "true") return;

  const quote = await prisma.quotation.findUnique({ where: { id: quoteId } });
  if (!quote || quote.status !== QuoteStatus.APPROVED) return;

  try {
    await convertQuotationToOrder(quote);
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_CONVERTED") return;
    console.error("[auto-convert-quote]", e);
  }
}
