import type { Metadata } from "next";
import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate";
import { LEGAL_PAGE_META } from "@/lib/cms-config";
import { loadLegalPage } from "@/lib/legal-page";

export const revalidate = 3600;

const meta = LEGAL_PAGE_META.privacy;

export const metadata: Metadata = {
  title: meta.title,
  description: "How Prudential Atelier collects, uses, and protects your personal information.",
};

export default async function PrivacyPolicyPage() {
  const page = await loadLegalPage("privacy");
  return <LegalPageTemplate title={page.title} lastUpdated={page.lastUpdated} html={page.html} termsVersion={page.termsVersion} />;
}
