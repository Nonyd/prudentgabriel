import { Hero } from "@/components/home/Hero";
import { BrandMarquee } from "@/components/home/BrandMarquee";
import { NewCollections } from "@/components/home/NewCollections";
import { PrudentialBride } from "@/components/home/PrudentialBride";
import { BespokeCouture } from "@/components/home/BespokeCouture";
import { AtelierStory } from "@/components/home/AtelierStory";
import { CollectionsGrid } from "@/components/home/CollectionsGrid";
import { PFABanner } from "@/components/common/PFABanner";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { getImageSettings } from "@/lib/settings";

export const revalidate = 3600;

export default async function HomePage() {
  let images: Record<string, string> = {};
  try {
    images = await getImageSettings();
  } catch {
    images = {};
  }

  return (
    <>
      <Hero heroImage={images.img_hero} />
      <BrandMarquee />
      <NewCollections />
      <CollectionsGrid
        bridalImage={images.img_collection_bridal}
        eveningImage={images.img_collection_evening}
        formalImage={images.img_collection_formal}
        rtwImage={images.img_collection_rtw}
      />
      <PrudentialBride heroImage={images.img_bride_hero} portraitImage={images.img_bride_portrait} />
      <BespokeCouture bespokeImage={images.img_bespoke} />
      <AtelierStory wideImage={images.img_atelier_wide} portraitImage={images.img_atelier_portrait} />
      <PFABanner />
      <NewsletterSection />
    </>
  );
}
