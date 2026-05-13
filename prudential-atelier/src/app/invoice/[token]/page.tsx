import type { Metadata } from "next";
import { PublicInvoiceView } from "@/components/invoice/PublicInvoiceView";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Invoice | Prudential Atelier`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicInvoiceView token={token} />;
}
