import type { Invoice } from "@prisma/client";
import type { InvoicePdfModel } from "@/components/invoice/InvoicePDF";
import {
  getBankDetails,
  getInvoiceSettings,
  parseInvoiceLineItems,
} from "@/lib/invoice";
import { getHouseDocumentTerms } from "@/lib/invoice-terms";
import { assembleInvoiceDocumentRender } from "@/lib/invoice-document";
import type { InvoiceCurrency } from "@/types/invoice";

function asCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP" || c === "EUR") return c;
  return "NGN";
}

export async function buildInvoicePdfModel(invoice: Invoice): Promise<InvoicePdfModel> {
  const cur = asCurrency(invoice.currency);
  const [business, bank, houseTerms] = await Promise.all([
    getInvoiceSettings(),
    getBankDetails(cur),
    getHouseDocumentTerms(),
  ]);
  const render = assembleInvoiceDocumentRender({
    currency: cur,
    expiresAt: invoice.expiresAt,
    houseTerms,
    bank,
    depositPercent: invoice.depositPercent,
    depositRequired: invoice.depositRequired,
    depositPaid: invoice.depositPaid,
    balanceDue: invoice.balanceDue,
  });
  return {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    currency: cur,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    expiresAt: invoice.expiresAt,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientPhone: invoice.clientPhone,
    clientAddress: invoice.clientAddress,
    clientCity: invoice.clientCity,
    clientCountry: invoice.clientCountry,
    lineItems: parseInvoiceLineItems(invoice.lineItems),
    subtotal: invoice.subtotal,
    discountType: invoice.discountType,
    discountValue: invoice.discountValue,
    discountAmount: invoice.discountAmount,
    vatEnabled: invoice.vatEnabled,
    vatPercent: invoice.vatPercent,
    vatAmount: invoice.vatAmount,
    total: invoice.total,
    depositRequired: invoice.depositRequired,
    depositPaid: invoice.depositPaid,
    balanceDue: invoice.balanceDue,
    depositPercent: invoice.depositPercent,
    depositLabel: render.depositLabel,
    payInstruction: render.payInstruction,
    houseTerms: render.houseTerms,
    expired: render.expired,
    paymentTerms: invoice.paymentTerms,
    clientNote: invoice.clientNote,
    showVat: invoice.showVat,
    showRcNumber: invoice.showRcNumber,
    business,
    bank,
  };
}
