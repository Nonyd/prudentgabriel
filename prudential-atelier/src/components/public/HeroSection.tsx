import { getImageSettings } from "@/lib/settings";
import { HeroSectionClient } from "./HeroSectionClient";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=85";

export async function HeroSection() {
  let heroImage = DEFAULT_HERO;

  try {
    const imgs = await getImageSettings();
    if (imgs.img_hero?.trim()) heroImage = imgs.img_hero.trim();
  } catch {
    // use default
  }

  return <HeroSectionClient heroImage={heroImage} />;
}
