import { getCMSContent } from "@/lib/cms";
import { BrandQuoteSectionClient } from "./BrandQuoteSectionClient";

export async function BrandQuoteSection() {
  const cms = await getCMSContent(["home_quote_text", "home_quote_attribution", "home_quote_label"]);
  return <BrandQuoteSectionClient cms={cms} />;
}
