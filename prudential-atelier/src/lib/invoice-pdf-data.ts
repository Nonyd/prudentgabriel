import type { Invoice } from "@prisma/client";
import type { InvoicePdfModel } from "@/components/invoice/InvoicePDF";
import {
  getBankDetails,
  getInvoiceSettings,
  parseInvoiceLineItems,
} from "@/lib/invoice";
import type { InvoiceCurrency } from "@/types/invoice";

function asCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP") return c;
  return "NGN";
}

export async function buildInvoicePdfModel(invoice: Invoice): Promise<InvoicePdfModel> {
  const cur = asCurrency(invoice.currency);
  const [business, bank] = await Promise.all([getInvoiceSettings(), getBankDetails(cur)]);
  return {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    currency: cur,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
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
    paymentTerms: invoice.paymentTerms,
    clientNote: invoice.clientNote,
    showVat: invoice.showVat,
    showRcNumber: invoice.showRcNumber,
    business,
    bank,
  };
}
