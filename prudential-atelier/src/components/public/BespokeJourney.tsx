import { cmsBool, getCMSContent } from "@/lib/cms";
import { BespokeJourneySection } from "./BespokeJourneySection";

export async function BespokeJourney() {
  const cms = await getCMSContent([
    "home_journey_enabled",
    "home_journey_eyebrow",
    "home_journey_headline",
    "home_journey_body",
    "home_journey_button_label",
    "home_journey_button_link",
  ]);
  if (!cmsBool(cms, "home_journey_enabled", true)) return null;
  return <BespokeJourneySection cms={cms} />;
}
