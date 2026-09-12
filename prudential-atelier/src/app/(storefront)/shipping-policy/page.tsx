import type { Metadata } from "next";
import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate";
import { LEGAL_PAGE_META } from "@/lib/cms-config";
import { loadLegalPage } from "@/lib/legal-page";

export const revalidate = 3600;

const meta = LEGAL_PAGE_META.shipping;

export const metadata: Metadata = {
  title: meta.title,
  description: "Shipping times, costs, and delivery information for Prudential Atelier orders.",
};

export default async function ShippingPolicyPage() {
  const page = await loadLegalPage("shipping");
  return <LegalPageTemplate title={page.title} lastUpdated={page.lastUpdated} html={page.html} termsVersion={page.termsVersion} />;
}
