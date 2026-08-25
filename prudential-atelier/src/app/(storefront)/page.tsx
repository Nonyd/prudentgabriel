import { HeroSection } from "@/components/public/HeroSection";
import { BestSellers } from "@/components/public/BestSellers";
import { CategoryGrid } from "@/components/public/CategoryGrid";
import { BespokeJourney } from "@/components/public/BespokeJourney";
import { HomeTestimonialsSection } from "@/components/home/HomeTestimonialsSection";
import { BrandQuoteSection } from "@/components/public/BrandQuoteSection";
import { PFACrosslinkBanner } from "@/components/public/PFACrosslinkBanner";
import { BlogPreview } from "@/components/public/BlogPreview";
import { getSetting } from "@/lib/settings";
import { ATELIER_STOREFRONT_SETTING_KEY } from "@/lib/atelier-storefront";

export const revalidate = 300;

export default async function HomePage() {
  const atelierEnabled = (await getSetting(ATELIER_STOREFRONT_SETTING_KEY)) === "true";

  return (
    <>
      <HeroSection />
      <BestSellers />
      <CategoryGrid atelierEnabled={atelierEnabled} />
      <BespokeJourney />
      <HomeTestimonialsSection />
      <BrandQuoteSection />
      <PFACrosslinkBanner />
      <BlogPreview />
    </>
  );
}
