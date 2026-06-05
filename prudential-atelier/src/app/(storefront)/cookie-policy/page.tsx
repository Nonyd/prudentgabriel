import type { Metadata } from "next";
import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate";
import { LEGAL_PAGE_META } from "@/lib/cms-config";
import { cmsGet, getCMSContent } from "@/lib/cms";

export const revalidate = 3600;

const meta = LEGAL_PAGE_META.cookie;

export const metadata: Metadata = {
  title: meta.title,
  description: "How Prudential Atelier uses cookies and how you can manage your preferences.",
};

export default async function CookiePolicyPage() {
  const cms = await getCMSContent([meta.contentKey]);
  const html = cmsGet(cms, meta.contentKey, "<p>Cookie policy content is being prepared.</p>");

  return <LegalPageTemplate title={meta.title} lastUpdated={meta.lastUpdated} html={html} />;
}
