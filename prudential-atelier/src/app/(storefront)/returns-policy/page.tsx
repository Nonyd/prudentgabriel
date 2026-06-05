import type { Metadata } from "next";
import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate";
import { LEGAL_PAGE_META } from "@/lib/cms-config";
import { cmsGet, getCMSContent } from "@/lib/cms";

export const revalidate = 3600;

const meta = LEGAL_PAGE_META.returns;

export const metadata: Metadata = {
  title: meta.title,
  description: "Returns, exchanges, and refunds policy for Prudential Atelier.",
};

export default async function ReturnsPolicyPage() {
  const cms = await getCMSContent([meta.contentKey]);
  const html = cmsGet(cms, meta.contentKey, "<p>Returns policy content is being prepared.</p>");

  return <LegalPageTemplate title={meta.title} lastUpdated={meta.lastUpdated} html={html} />;
}
