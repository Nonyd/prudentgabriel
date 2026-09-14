import type { Metadata } from "next";
import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate";
import { loadLegalPage } from "@/lib/legal-page";
import { legalRouteMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return legalRouteMetadata("terms");
}

export default async function TermsPage() {
  const page = await loadLegalPage("terms");
  return <LegalPageTemplate title={page.title} lastUpdated={page.lastUpdated} html={page.html} termsVersion={page.termsVersion} />;
}
