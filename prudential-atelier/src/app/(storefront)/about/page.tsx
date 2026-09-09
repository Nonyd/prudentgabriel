import { GalleryCategory } from "@prisma/client";
import { AboutHousePage } from "@/components/about/AboutHousePage";
import { cmsBool, cmsGet, cmsJson, getCMSContent } from "@/lib/cms";
import { filterAboutStats, pickAboutLooks, type AboutLook } from "@/lib/about-house";
import { DEFAULT_ABOUT_VALUES } from "@/lib/page-content-defaults";
import {
  HOUSE_ADDRESS_LINE_1,
  HOUSE_ADDRESS_LINE_2,
  HOUSE_MAPS_LINK,
  resolveHouseAddressBlock,
  resolveHouseMapsLink,
} from "@/lib/house-address";
import { prisma } from "@/lib/prisma";
import { getImageSettings } from "@/lib/settings";
import { isSkipDbBuild } from "@/lib/skip-db-build";

export const revalidate = 300;

const ABOUT_KEYS = [
  "about_hero_headline",
  "about_hero_subtext",
  "about_hero_media_1",
  "about_hero_media_2",
  "about_hero_media_3",
  "about_story_headline",
  "about_story_paragraph_1",
  "about_story_paragraph_2",
  "about_story_paragraph_3",
  "about_story_image",
  "about_founder_name",
  "about_founder_title",
  "about_founder_photo",
  "about_founder_bio_1",
  "about_founder_bio_2",
  "about_founder_bio_3",
  "about_founder_quote",
  "about_stat_1_number",
  "about_stat_1_label",
  "about_stat_2_number",
  "about_stat_2_label",
  "about_stat_3_number",
  "about_stat_3_label",
  "about_stat_4_number",
  "about_stat_4_label",
  "about_values_headline",
  "about_values",
  "about_locations_headline",
  "about_lagos_name",
  "about_lagos_address",
  "about_lagos_hours",
  "about_lagos_maps_link",
  "about_academy_enabled",
  "about_academy_headline",
  "about_academy_body",
  "about_academy_cta_label",
  "about_academy_cta_link",
  "about_cta_headline",
  "about_cta_quote",
  "about_cta_button_1_label",
  "about_cta_button_1_link",
  "about_cta_button_2_label",
  "about_cta_button_2_link",
] as const;

const FALLBACK_LOOKS = [
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&q=80",
  "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&q=80",
];

export default async function AboutPage() {
  let cms: Record<string, string> = {};
  let storyHero = FALLBACK_LOOKS[0];
  const founderFallback = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80";
  let galleryLooks: AboutLook[] = [];

  if (!isSkipDbBuild()) {
    try {
      const [content, images, gallery] = await Promise.all([
        getCMSContent([...ABOUT_KEYS]),
        getImageSettings(),
        prisma.galleryImage.findMany({
          where: { isPublished: true, category: { in: [GalleryCategory.ATELIER, GalleryCategory.BRIDAL] } },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          take: 8,
          select: { url: true, alt: true },
        }),
      ]);
      cms = content;
      if (images.img_our_story_hero?.trim()) storyHero = images.img_our_story_hero;
      galleryLooks = gallery.map((row) => ({ url: row.url, alt: row.alt || "Prudential Atelier" }));
    } catch {
      /* defaults */
    }
  }

  const storyImage = cmsGet(cms, "about_story_image", "") || storyHero;
  const founderImage = cmsGet(cms, "about_founder_photo", "") || founderFallback;
  const values = cmsJson(cms, "about_values", DEFAULT_ABOUT_VALUES);
  const showAcademy = cmsBool(cms, "about_academy_enabled", true);

  const looks = pickAboutLooks(
    [
      ...["about_hero_media_1", "about_hero_media_2", "about_hero_media_3"].map((key) => ({
        url: cmsGet(cms, key, ""),
        alt: "The house",
      })),
      ...galleryLooks,
      { url: storyImage, alt: "The Lagos atelier" },
      { url: founderImage, alt: cmsGet(cms, "about_founder_name", "Mrs. Prudent Gabriel-Okopi") },
      ...FALLBACK_LOOKS.map((url) => ({ url, alt: "Prudential Atelier" })),
    ],
    3,
  );

  const stats = filterAboutStats([
    { number: cmsGet(cms, "about_stat_1_number", "15+"), label: cmsGet(cms, "about_stat_1_label", "Years of couture") },
    {
      number: cmsGet(cms, "about_stat_2_number", "500+"),
      label: cmsGet(cms, "about_stat_2_label", "Commissions delivered"),
    },
    {
      number: cmsGet(cms, "about_stat_3_number", "10,000+"),
      label: cmsGet(cms, "about_stat_3_label", "Clients dressed"),
    },
    { number: cmsGet(cms, "about_stat_4_number", "1"), label: cmsGet(cms, "about_stat_4_label", "Lagos atelier") },
  ]);

  const lagosAddress = resolveHouseAddressBlock(
    cmsGet(cms, "about_lagos_address", `${HOUSE_ADDRESS_LINE_1}\n${HOUSE_ADDRESS_LINE_2}`),
  );
  const lagosMaps = resolveHouseMapsLink(cmsGet(cms, "about_lagos_maps_link", HOUSE_MAPS_LINK));

  return (
    <main>
      <AboutHousePage
        headline={cmsGet(cms, "about_hero_headline", "The House of Prudent Gabriel")}
        subtext={cmsGet(cms, "about_hero_subtext", "Founded in Lagos. Worn around the world.")}
        looks={looks}
        storyHeadline={cmsGet(cms, "about_story_headline", "From a dream to a dynasty.")}
        storyParagraphs={[
          cmsGet(cms, "about_story_paragraph_1", ""),
          cmsGet(cms, "about_story_paragraph_2", ""),
          cmsGet(cms, "about_story_paragraph_3", ""),
        ]}
        storyImage={storyImage}
        founderName={cmsGet(cms, "about_founder_name", "Mrs. Prudent Gabriel-Okopi")}
        founderTitle={cmsGet(cms, "about_founder_title", "Founder and Creative Director")}
        founderImage={founderImage}
        founderBios={[
          cmsGet(cms, "about_founder_bio_1", ""),
          cmsGet(cms, "about_founder_bio_2", ""),
          cmsGet(cms, "about_founder_bio_3", ""),
        ]}
        founderQuote={cmsGet(cms, "about_founder_quote", "We don't make clothes. We make the way you'll be remembered.")}
        stats={stats}
        valuesHeadline={cmsGet(cms, "about_values_headline", "The principles behind every piece")}
        values={values}
        atelierHeadline={cmsGet(cms, "about_locations_headline", "The Lagos atelier")}
        atelier={{
          name: cmsGet(cms, "about_lagos_name", "Lagos"),
          address: lagosAddress,
          hours: cmsGet(cms, "about_lagos_hours", "Mon-Fri: 9am-6pm. Sat: 10am-4pm"),
          maps: lagosMaps,
        }}
        atelierLook={looks[0] ?? { url: storyImage, alt: "The Lagos atelier" }}
        showAcademy={showAcademy}
        academyHeadline={cmsGet(cms, "about_academy_headline", "Prudential Fashion Academy")}
        academyBody={cmsGet(cms, "about_academy_body", "Pattern-cutting, beading and bridal, taught in the Lagos atelier.")}
        academyCtaLabel={cmsGet(cms, "about_academy_cta_label", "Explore PFA")}
        academyCtaLink={cmsGet(cms, "about_academy_cta_link", "https://pfacademy.ng")}
        ctaHeadline={cmsGet(cms, "about_cta_headline", "Ready to begin your commission?")}
        ctaQuote={cmsGet(cms, "about_cta_quote", "Every great piece begins with a conversation.")}
        ctaPrimaryLabel={cmsGet(cms, "about_cta_button_1_label", "Book a consultation")}
        ctaPrimaryHref={cmsGet(cms, "about_cta_button_1_link", "/consultation")}
        ctaSecondaryLabel={cmsGet(cms, "about_cta_button_2_label", "Browse the collection")}
        ctaSecondaryHref={cmsGet(cms, "about_cta_button_2_link", "/rtw")}
      />
    </main>
  );
}
