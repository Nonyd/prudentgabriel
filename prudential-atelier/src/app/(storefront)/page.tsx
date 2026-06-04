import { HeroSection } from "@/components/public/HeroSection";
import { CategoryGrid } from "@/components/public/CategoryGrid";
import { BestSellers } from "@/components/public/BestSellers";
import { ConsultationWidget } from "@/components/public/ConsultationWidget";
import { LoyaltyStrip } from "@/components/public/LoyaltyStrip";
import { BlogPreview } from "@/components/public/BlogPreview";

export const revalidate = 300;

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <CategoryGrid />
      <BestSellers />
      <ConsultationWidget />
      <LoyaltyStrip />
      <BlogPreview />
    </>
  );
}
