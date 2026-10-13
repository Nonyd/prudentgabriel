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
    return { label: "—", className: "text-text-mid" };
  }

  const order = quotation.bespokeOrders[0];
  if (quotation.status === "CONVERTED" && order) {
    return { label: `Order ${order.orderRef}`, className: "font-medium text-ink" };
  }
  if (quotation.status === "APPROVED") {
    return { label: "Approved ✓", className: "text-success" };
  }
  if (quotation.status === "SENT") {
    return { label: `Sent ${quotation.quoteRef}`, className: "text-blue-700" };
  }
  if (quotation.status === "DRAFT") {
    return { label: `Draft ${quotation.quoteRef}`, className: "text-warning" };
  }
  if (quotation.status === "REJECTED") {
    return { label: `Rejected ${quotation.quoteRef}`, className: "text-text-mid" };
  }
  return { label: quotation.quoteRef, className: "text-ink" };
}
