import type { Metadata } from "next";
import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate";
import { loadLegalPage } from "@/lib/legal-page";
import { legalRouteMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return legalRouteMetadata("cookie");
}

export default async function CookiePolicyPage() {
  const page = await loadLegalPage("cookie");
  return <LegalPageTemplate title={page.title} lastUpdated={page.lastUpdated} html={page.html} termsVersion={page.termsVersion} />;
}
