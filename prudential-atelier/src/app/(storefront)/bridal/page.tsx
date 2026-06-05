import type { Metadata } from "next";
import { GalleryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BridalGalleryPage } from "@/components/gallery/BridalGalleryPage";
import { cmsGet, getCMSContent } from "@/lib/cms";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Prudential Bride | Prudent Gabriel",
  description: "Every bride is a masterpiece. Explore the Prudential Bride collection.",
};

const LIMIT = 24;

export default async function BridalPage() {
  const where = { isPublished: true, category: GalleryCategory.BRIDAL };
  const [images, total, cms] = await Promise.all([
    prisma.galleryImage.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: LIMIT,
    }),
    prisma.galleryImage.count({ where }),
    getCMSContent(["bridal_hero_headline", "bridal_hero_subtext", "bridal_page_description", "bridal_gallery_label"]),
  ]);

  return (
    <main>
      <BridalGalleryPage
        initialImages={images}
        initialTotal={total}
        initialHasMore={total > LIMIT}
        heroHeadline={cmsGet(cms, "bridal_hero_headline", "Bridal.")}
        heroSubtext={cmsGet(cms, "bridal_hero_subtext", "Every bride is a masterpiece. Every gown, a legacy.")}
        pageDescription={cmsGet(cms, "bridal_page_description", "Every bride is a masterpiece. Every gown, a legacy.")}
        galleryLabel={cmsGet(cms, "bridal_gallery_label", "PRUDENTIAL BRIDE")}
      />
    </main>
  );
}
