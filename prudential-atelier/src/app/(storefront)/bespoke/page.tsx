import { BespokePageContent } from "@/components/bespoke/BespokePageContent";
import { getImageSettings } from "@/lib/settings";

export default async function BespokePage() {
  let hero = "";
  try {
    const img = await getImageSettings();
    hero = img.img_bespoke_hero ?? "";
  } catch {
    hero = "";
  }
  return <BespokePageContent heroImage={hero} />;
}
