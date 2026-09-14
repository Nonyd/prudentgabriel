import type { Metadata } from "next";
import { PublicInvoiceView } from "@/components/invoice/PublicInvoiceView";
import { tokenRouteMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return tokenRouteMetadata("Invoice");
}

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicInvoiceView token={token} />;
}
