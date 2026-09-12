import type { Metadata } from "next";
import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate";
import { LEGAL_PAGE_META } from "@/lib/cms-config";
import { loadLegalPage } from "@/lib/legal-page";

export const revalidate = 3600;

const meta = LEGAL_PAGE_META.terms;

export const metadata: Metadata = {
  title: meta.title,
  description: "Terms and conditions for using prudentgabriel.com and our services.",
};

export default async function TermsPage() {
  const page = await loadLegalPage("terms");
  return <LegalPageTemplate title={page.title} lastUpdated={page.lastUpdated} html={page.html} />;
}
