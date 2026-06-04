import { getImageSettings } from "@/lib/settings";
import { BespokeJourneySection as BespokeJourneyClient } from "./BespokeJourneySection";

export async function BespokeJourney() {
  let imageUrl = "";

  try {
    const imgs = await getImageSettings();
    imageUrl = imgs.img_bespoke?.trim() || imgs.img_atelier_wide?.trim() || "";
  } catch {
    imageUrl = "";
  }

  return <BespokeJourneyClient imageUrl={imageUrl || undefined} />;
}
