import { Hero } from "@/components/home/Hero";
import { BrandMarquee } from "@/components/home/BrandMarquee";
import { NewCollections } from "@/components/home/NewCollections";
import { PrudentialBride } from "@/components/home/PrudentialBride";
import { BespokeCouture } from "@/components/home/BespokeCouture";
import { AtelierStory } from "@/components/home/AtelierStory";
import { CollectionsGrid } from "@/components/home/CollectionsGrid";
import { PFABanner } from "@/components/common/PFABanner";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { getContent, getContentSettings, getImageSettings } from "@/lib/settings";

export const revalidate = 3600;

export default async function HomePage() {
  let images: Record<string, string> = {};
  let content: Record<string, string> = {};
  try {
    const [img, c] = await Promise.all([getImageSettings(), getContentSettings()]);
    images = img;
    content = c;
  } catch {
    images = {};
    content = {};
  }

  const announce = [
    getContent(content, "content_announce_1", "FREE SHIPPING ON ORDERS OVER ₦150,000 WITHIN LAGOS"),
    getContent(content, "content_announce_2", "NEW COLLECTION — THE EDIT IS NOW LIVE"),
    getContent(content, "content_announce_3", "BOOK YOUR BESPOKE CONSULTATION TODAY"),
  ];

  return (
    <>
      <Hero
        heroImage={images.img_hero}
        label={getContent(content, "content_hero_label", "SS 2025 COLLECTION")}
        headline={getContent(content, "content_hero_headline", "The New\nEdit.")}
        subtext={getContent(
          content,
          "content_hero_subtext",
          "Designed for the woman who commands every room she enters.",
        )}
        cta1Text={getContent(content, "content_hero_cta1", "SHOP THE COLLECTION")}
        cta2Text={getContent(content, "content_hero_cta2", "BOOK BESPOKE")}
      />
      <BrandMarquee messages={announce} />
      <NewCollections
        label={getContent(content, "content_rtw_label", "READY TO WEAR")}
        headline={getContent(content, "content_rtw_headline", "New Collections")}
      />
      <CollectionsGrid
        bridalImage={images.img_collection_bridal}
        eveningImage={images.img_collection_evening}
        formalImage={images.img_collection_formal}
        rtwImage={images.img_collection_rtw}
      />
      <PrudentialBride
        label={getContent(content, "content_bride_label", "PRUDENTIAL BRIDE")}
        headline={getContent(content, "content_bride_headline", "For the Bride\nWho Dares to\nBe Remembered.")}
        body={getContent(
          content,
          "content_bride_body",
          "Prudential Bride is our most intimate offering. Each gown is a singular creation — hand-crafted in our Lagos atelier, built around your story.",
        )}
        cta1Text={getContent(content, "content_bride_cta1", "EXPLORE BRIDAL COLLECTION")}
        cta2Text={getContent(content, "content_bride_cta2", "BOOK BRIDAL CONSULTATION")}
        heroImage={images.img_bride_hero}
        portraitImage={images.img_bride_portrait}
      />
      <BespokeCouture
        label={getContent(content, "content_bespoke_label", "BESPOKE COUTURE")}
        headline={getContent(content, "content_bespoke_headline", "One Piece.\nOne Story.\nYours.")}
        body={getContent(
          content,
          "content_bespoke_body",
          "From the first sketch to the final stitch — every bespoke piece is conceived, designed, and hand-crafted exclusively for you.",
        )}
        bespokeImage={images.img_bespoke}
      />
      <AtelierStory
        label={getContent(content, "content_atelier_label", "THE ATELIER")}
        headline={getContent(content, "content_atelier_headline", "Built in Lagos.\nWorn Worldwide.")}
        body={getContent(
          content,
          "content_atelier_body",
          "Prudent Gabriel began as a single vision in Lagos, Nigeria. Today, our pieces are worn at weddings, galas, and boardrooms across four continents. Every creation carries the mark of our atelier — made by hand, made to last.",
        )}
        wideImage={images.img_atelier_wide}
        portraitImage={images.img_atelier_portrait}
      />
      <PFABanner
        label={getContent(content, "content_pfa_label", "PRUDENTIAL FASHION ACADEMY")}
        text={getContent(
          content,
          "content_pfa_text",
          "Over 5,000 designers trained. The school behind the brand.",
        )}
        ctaText={getContent(content, "content_pfa_cta", "EXPLORE PFA →")}
      />
      <NewsletterSection
        headline={getContent(content, "content_newsletter_headline", "Join the Inner Circle.")}
        subtext={getContent(
          content,
          "content_newsletter_subtext",
          "New collections, exclusive access, and stories from the atelier.",
        )}
      />
    </>
  );
}
