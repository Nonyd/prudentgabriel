import { BespokePageContent } from "@/components/bespoke/BespokePageContent";
import { getContent, getContentSettings, getImageSettings } from "@/lib/settings";

export default async function BespokePage() {
  let hero = "";
  let pageHeadline = "Your Vision,\nOur Craft.";
  try {
    const [img, c] = await Promise.all([getImageSettings(), getContentSettings()]);
    hero = img.img_bespoke_hero ?? "";
    pageHeadline = getContent(c, "content_bespoke_page_headline", pageHeadline);
  } catch {
    hero = "";
  }
  return <BespokePageContent heroImage={hero} pageHeadline={pageHeadline} />;
}
