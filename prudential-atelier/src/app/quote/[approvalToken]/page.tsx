import { notFound } from "next/navigation";
import { tokenPageRateLimited } from "@/lib/page-rate-limit";
import Link from "next/link";
import { QuoteStatus } from "@prisma/client";
import {
  QuoteApprovalClient,
  type QuoteApprovalData,
} from "@/components/public/QuoteApprovalClient";
import { findLatestQuotationVersion } from "@/lib/quotation-versioning";
import { getHouseDocumentTerms } from "@/lib/invoice-terms";
import { tokenRouteMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import {
  ensureQuoteApprovalRaw,
  findQuotationByApprovalToken,
} from "@/lib/capability-token-lookup";

type Props = { params: Promise<{ approvalToken: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return tokenRouteMetadata("Quotation");
}

export default async function QuoteApprovalPage({ params }: Props) {
  if (await tokenPageRateLimited("quote-token-page")) notFound();
  const { approvalToken } = await params;

  const found = await findQuotationByApprovalToken(approvalToken);
  if (!found.ok) {
    // Expired and unknown alike: a real 404, rendered by ./not-found.tsx.
    notFound();
  }
  const quote = found.quote;

  if (quote.status === QuoteStatus.SUPERSEDED) {
    const latest = await findLatestQuotationVersion(quote.baseQuoteRef);
    let latestHref: string | null = null;
    if (latest) {
      const raw = await ensureQuoteApprovalRaw(latest);
      latestHref = `/quote/${raw}`;
    }
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
        {latest && latestHref ? (
          <Link
            href={latestHref}
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

  const houseTerms = await getHouseDocumentTerms();

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
    approvalToken,
    currency: quote.currency || "NGN",
    depositPercent: quote.depositPercent,
    houseTerms,
  };

  return (
    <div className="min-h-screen bg-bg">
      <QuoteApprovalClient quote={data} />
    </div>
  );
}
