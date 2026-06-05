import type { Metadata } from "next";
import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate";
import { LEGAL_PAGE_META } from "@/lib/cms-config";
import { cmsGet, getCMSContent } from "@/lib/cms";

export const revalidate = 3600;

const meta = LEGAL_PAGE_META.terms;

export const metadata: Metadata = {
  title: meta.title,
  description: "Terms and conditions for using prudentgabriel.com and our services.",
};

export default async function TermsPage() {
  const cms = await getCMSContent([meta.contentKey]);
  const html = cmsGet(cms, meta.contentKey, "<p>Terms and conditions content is being prepared.</p>");

  return <LegalPageTemplate title={meta.title} lastUpdated={meta.lastUpdated} html={html} />;
}
