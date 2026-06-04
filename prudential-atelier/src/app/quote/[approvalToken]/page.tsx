import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  QuoteApprovalClient,
  type QuoteApprovalData,
} from "@/components/public/QuoteApprovalClient";

type Props = { params: Promise<{ approvalToken: string }> };

export default async function QuoteApprovalPage({ params }: Props) {
  const { approvalToken } = await params;

  const quote = await prisma.quotation.findUnique({
    where: { approvalToken },
  });

  if (!quote) notFound();

  const lineItems = Array.isArray(quote.lineItems)
    ? (quote.lineItems as QuoteApprovalData["lineItems"])
    : [];

  const data: QuoteApprovalData = {
    id: quote.id,
    quoteRef: quote.quoteRef,
    clientName: quote.clientName,
    clientEmail: quote.clientEmail,
    lineItems,
    subtotal: quote.subtotal,
    tax: quote.tax,
    discount: quote.discount,
    total: quote.total,
    notes: quote.notes,
    status: quote.status,
    expiresAt: quote.expiresAt?.toISOString() ?? null,
    approvalToken: quote.approvalToken,
  };

  return (
    <div className="min-h-screen bg-bg">
      <QuoteApprovalClient quote={data} />
    </div>
  );
}
