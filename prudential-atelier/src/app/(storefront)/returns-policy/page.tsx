import type { Metadata } from "next";
import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate";
import { LEGAL_PAGE_META } from "@/lib/cms-config";
import { loadLegalPage } from "@/lib/legal-page";

export const revalidate = 3600;

const meta = LEGAL_PAGE_META.returns;

export const metadata: Metadata = {
  title: meta.title,
  description: "Returns, exchanges, and refunds policy for Prudential Atelier.",
};

export default async function ReturnsPolicyPage() {
  const page = await loadLegalPage("returns");
  return <LegalPageTemplate title={page.title} lastUpdated={page.lastUpdated} html={page.html} termsVersion={page.termsVersion} />;
}
