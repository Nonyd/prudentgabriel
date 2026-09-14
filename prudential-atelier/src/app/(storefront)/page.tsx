import type { Metadata } from "next";
import { HeroSection } from "@/components/public/HeroSection";
import { CategoryGrid } from "@/components/public/CategoryGrid";
import { BestSellers } from "@/components/public/BestSellers";
import { HomeBridalBand } from "@/components/public/HomeBridalBand";
import { BespokeJourney } from "@/components/public/BespokeJourney";
import { HomeTestimonialsSection } from "@/components/home/HomeTestimonialsSection";
import { BrandQuoteSection } from "@/components/public/BrandQuoteSection";
import { PFACrosslinkBanner } from "@/components/public/PFACrosslinkBanner";
import { BlogPreview } from "@/components/public/BlogPreview";
import { cmsRouteMetadata } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return cmsRouteMetadata("homepage", "/");
}

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
