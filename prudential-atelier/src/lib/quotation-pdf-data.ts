import type { Quotation } from "@prisma/client";
import { nanoid } from "nanoid";
import type { QuotationPdfModel, QuotationPdfLineItem } from "@/components/quotation/QuotationPDF";
import { getBankDetails, getInvoiceSettings } from "@/lib/invoice";
import { getBespokeDepositPercent } from "@/lib/payments/ledger";

function parseQuoteLines(raw: unknown): QuotationPdfLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as {
      description?: string;
      quantity?: number;
      unitPrice?: number;
      total?: number;
    };
    const quantity = Number(r.quantity) || 1;
    const unitPrice = Number(r.unitPrice) || 0;
    const amount = Number(r.total) || quantity * unitPrice;
    return {
      id: nanoid(),
      description: String(r.description ?? "Line item"),
      quantity,
      unitPrice,
      amount,
    };
  });
}

export async function buildQuotationPdfModel(quote: Quotation): Promise<QuotationPdfModel> {
  const [business, bank, depositPercent] = await Promise.all([
    getInvoiceSettings(),
    getBankDetails("NGN"),
    getBespokeDepositPercent(),
  ]);
  const depositRequired = Math.round(quote.total * (depositPercent / 100) * 100) / 100;
  const expiresLabel = quote.expiresAt
    ? quote.expiresAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return {
    quoteRef: quote.quoteRef,
    version: quote.version,
    status: quote.status,
    currency: "NGN",
    issuedAt: quote.sentAt ?? quote.createdAt,
    expiresAt: quote.expiresAt,
    clientName: quote.clientName,
    clientEmail: quote.clientEmail,
    clientPhone: quote.clientPhone,
    lineItems: parseQuoteLines(quote.lineItems),
    subtotal: quote.subtotal,
    discount: quote.discount,
    tax: quote.tax,
    total: quote.total,
    depositPercent,
    depositRequired,
    validityStatement: expiresLabel
      ? `This quotation is valid until ${expiresLabel}. Prices and availability may change after that date.`
      : "This quotation is valid for 14 days from the issue date unless otherwise stated.",
    notes: quote.notes,
    business,
    bank,
  };
}
