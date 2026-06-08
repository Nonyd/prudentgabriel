import type { QuoteStatus } from "@prisma/client";

type QuotationRow = {
  quoteRef: string;
  status: QuoteStatus;
  bespokeOrders: { orderRef: string }[];
};

export function formatConsultationQuotationStatus(
  quotation: QuotationRow | null | undefined,
): { label: string; className: string } {
  if (!quotation) {
    return { label: "—", className: "text-[#6B6B68]" };
  }

  const order = quotation.bespokeOrders[0];
  if (quotation.status === "CONVERTED" && order) {
    return { label: `Order ${order.orderRef}`, className: "font-medium text-ink" };
  }
  if (quotation.status === "APPROVED") {
    return { label: "Approved ✓", className: "text-emerald-700" };
  }
  if (quotation.status === "SENT") {
    return { label: `Sent ${quotation.quoteRef}`, className: "text-blue-700" };
  }
  if (quotation.status === "DRAFT") {
    return { label: `Draft ${quotation.quoteRef}`, className: "text-amber-700" };
  }
  if (quotation.status === "REJECTED") {
    return { label: `Rejected ${quotation.quoteRef}`, className: "text-[#6B6B68]" };
  }
  return { label: quotation.quoteRef, className: "text-ink" };
}
