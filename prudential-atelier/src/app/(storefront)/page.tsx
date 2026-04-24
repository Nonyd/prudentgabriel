import { Hero } from "@/components/home/Hero";
import { BrandMarquee } from "@/components/home/BrandMarquee";
import { NewCollections } from "@/components/home/NewCollections";
import { PrudentialBride } from "@/components/home/PrudentialBride";
import { BespokeCouture } from "@/components/home/BespokeCouture";
import { AtelierStory } from "@/components/home/AtelierStory";
import { PFABanner } from "@/components/common/PFABanner";
import { NewsletterSection } from "@/components/home/NewsletterSection";

export const revalidate = 3600;

export default function HomePage() {
  return (
    <>
      <Hero />
      <BrandMarquee />
      <NewCollections />
      <PrudentialBride />
      <BespokeCouture />
      <AtelierStory />
      <PFABanner />
      <NewsletterSection />
    </>
  );
}
