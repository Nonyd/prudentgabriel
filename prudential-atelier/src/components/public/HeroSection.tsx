import { getCMSContent } from "@/lib/cms";
import { resolveHeroCarouselItems, type HeroCarouselItem } from "@/lib/hero-carousel";
import { prisma } from "@/lib/prisma";
import { HeroSectionClient } from "./HeroSectionClient";

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
  "home_hero_stat_number",
  "home_hero_stat_label",
] as const;

export async function HeroSection() {
  let cms: Record<string, string> = {};
  let carouselItems: HeroCarouselItem[] = resolveHeroCarouselItems(undefined);

  try {
    const [content, carouselSetting] = await Promise.all([
      getCMSContent([...HERO_KEYS, "home_hero_carousel"]),
      prisma.siteSetting.findUnique({ where: { key: "home_hero_carousel" } }),
    ]);
    cms = content;
    carouselItems = resolveHeroCarouselItems(carouselSetting?.value ?? cms.home_hero_carousel);
  } catch {
    /* defaults */
  }

  return <HeroSectionClient cms={cms} carouselItems={carouselItems} />;
}
