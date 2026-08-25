import { cmsBool, getCMSContent } from "@/lib/cms";
import { getSetting } from "@/lib/settings";
import { ATELIER_STOREFRONT_SETTING_KEY } from "@/lib/atelier-storefront";
import { BespokeJourneySection } from "./BespokeJourneySection";

export async function BespokeJourney() {
  const [cms, atelierSetting] = await Promise.all([
    getCMSContent([
      "home_journey_enabled",
      "home_journey_eyebrow",
      "home_journey_headline",
      "home_journey_body",
      "home_journey_button_label",
      "home_journey_button_link",
    ]),
    getSetting(ATELIER_STOREFRONT_SETTING_KEY),
  ]);
  if (atelierSetting !== "true") return null;
  if (!cmsBool(cms, "home_journey_enabled", true)) return null;
  return <BespokeJourneySection cms={cms} />;
}
