import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tokenPageRateLimited } from "@/lib/page-rate-limit";
import { PublicInvoiceView } from "@/components/invoice/PublicInvoiceView";
import { findInvoiceByPublicToken } from "@/lib/capability-token-lookup";
import { tokenRouteMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return tokenRouteMetadata("Invoice");
}

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  if (await tokenPageRateLimited("invoice-token-page")) notFound();
  const { token } = await params;
  const found = await findInvoiceByPublicToken(token);
  if (!found.ok) {
    // Expired and unknown alike: a real 404, rendered by ./not-found.tsx.
    notFound();
  }
  return <PublicInvoiceView token={token} />;
}
