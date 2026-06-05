import { getImageSettings } from "@/lib/settings";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { HeroSectionClient } from "./HeroSectionClient";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=85";

const HERO_KEYS = [
  "home_hero_eyebrow",
  "home_hero_headline_1",
  "home_hero_headline_2",
  "home_hero_headline_3",
  "home_hero_subtext",
  "home_hero_button_1_label",
  "home_hero_button_1_link",
  "home_hero_button_2_label",
  "home_hero_button_2_link",
  "home_hero_image",
  "home_hero_stat_number",
  "home_hero_stat_label",
] as const;

export async function HeroSection() {
  let heroImage = DEFAULT_HERO;
  let cms: Record<string, string> = {};

  try {
    const [content, imgs] = await Promise.all([getCMSContent([...HERO_KEYS]), getImageSettings()]);
    cms = content;
    const cmsHero = cmsGet(cms, "home_hero_image", "");
    if (cmsHero.trim()) heroImage = cmsHero.trim();
    else if (imgs.img_hero?.trim()) heroImage = imgs.img_hero.trim();
  } catch {
    /* defaults */
  }

  return <HeroSectionClient heroImage={heroImage} cms={cms} />;
}
