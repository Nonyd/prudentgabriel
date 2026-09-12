import type { Metadata } from "next";
import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate";
import { LEGAL_PAGE_META } from "@/lib/cms-config";
import { loadLegalPage } from "@/lib/legal-page";

export const revalidate = 3600;

const meta = LEGAL_PAGE_META.cookie;

export const metadata: Metadata = {
  title: meta.title,
  description: "How Prudential Atelier uses cookies and how you can manage your preferences.",
};

export default async function CookiePolicyPage() {
  const page = await loadLegalPage("cookie");
  return <LegalPageTemplate title={page.title} lastUpdated={page.lastUpdated} html={page.html} />;
}
