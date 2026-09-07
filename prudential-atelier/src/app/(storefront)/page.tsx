import { HeroSection } from "@/components/public/HeroSection";
import { CategoryGrid } from "@/components/public/CategoryGrid";
import { BestSellers } from "@/components/public/BestSellers";
import { HomeBridalBand } from "@/components/public/HomeBridalBand";
import { BespokeJourney } from "@/components/public/BespokeJourney";
import { HomeTestimonialsSection } from "@/components/home/HomeTestimonialsSection";
import { BrandQuoteSection } from "@/components/public/BrandQuoteSection";
import { PFACrosslinkBanner } from "@/components/public/PFACrosslinkBanner";
import { BlogPreview } from "@/components/public/BlogPreview";

export const revalidate = 300;

export default async function HomePage() {
  return (
    <>
      <HeroSection />
      <CategoryGrid />
      <BestSellers />
      <HomeBridalBand />
      <BespokeJourney />
      <HomeTestimonialsSection />
      <BrandQuoteSection />
      <PFACrosslinkBanner />
      <BlogPreview />
    </>
  );
}
