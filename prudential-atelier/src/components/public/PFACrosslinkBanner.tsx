import { cmsBool, getCMSContent } from "@/lib/cms";
import { PFACrosslinkBannerClient } from "./PFACrosslinkBannerClient";

export async function PFACrosslinkBanner() {
  const cms = await getCMSContent([
    "home_pfa_enabled",
    "home_pfa_eyebrow",
    "home_pfa_headline",
    "home_pfa_body",
    "home_pfa_button_label",
    "home_pfa_button_link",
  ]);
  if (!cmsBool(cms, "home_pfa_enabled", true)) return null;
  return <PFACrosslinkBannerClient cms={cms} />;
}
