import { notFound } from "next/navigation";
import Link from "next/link";
import { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  QuoteApprovalClient,
  type QuoteApprovalData,
} from "@/components/public/QuoteApprovalClient";
import { findLatestQuotationVersion } from "@/lib/quotation-versioning";

type Props = { params: Promise<{ approvalToken: string }> };

export default async function QuoteApprovalPage({ params }: Props) {
  const { approvalToken } = await params;

  const quote = await prisma.quotation.findUnique({
    where: { approvalToken },
  });

  if (!quote) notFound();

  if (quote.status === QuoteStatus.SUPERSEDED) {
    const latest = await findLatestQuotationVersion(quote.baseQuoteRef);
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center bg-bg px-4 py-16 text-center">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">
          Prudential Atelier
        </p>
        <h1 className="mt-4 font-serif text-3xl text-choc">This quotation was revised</h1>
        <p className="mt-3 font-sans text-sm text-text-mid">
          <span className="font-medium text-choc">{quote.quoteRef}</span> is no longer valid. A newer
          version exists — approving this link would apply outdated terms.
        </p>
        {latest ? (
          <Link
            href={`/quote/${latest.approvalToken}`}
            className="mt-8 inline-flex items-center justify-center rounded-sm bg-choc px-6 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-cream"
          >
            Open {latest.quoteRef}
          </Link>
        ) : (
          <p className="mt-8 font-sans text-sm text-text-light">
            Please contact the atelier for the current quotation.
          </p>
        )}
      </div>
    );
  }

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
