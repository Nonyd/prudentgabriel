import { HeroSection } from "@/components/public/HeroSection";
import { BestSellers } from "@/components/public/BestSellers";
import { CategoryGrid } from "@/components/public/CategoryGrid";
import { BespokeJourney } from "@/components/public/BespokeJourney";
import { BrandQuoteSection } from "@/components/public/BrandQuoteSection";
import { PFACrosslinkBanner } from "@/components/public/PFACrosslinkBanner";
import { BlogPreview } from "@/components/public/BlogPreview";

export const revalidate = 300;

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <BestSellers />
      <CategoryGrid />
      <BespokeJourney />
      <BrandQuoteSection />
      <PFACrosslinkBanner />
      <BlogPreview />
    </>
  );
}
