import type { Metadata } from "next";
import { GalleryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { KidsGalleryPage } from "@/components/gallery/KidsGalleryPage";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import { cmsRouteMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return cmsRouteMetadata("kids", "/kids");
}

const LIMIT = 24;

export default async function KidsPage() {
  const where = { isPublished: true, category: GalleryCategory.KIDS };
  const [images, total, cms] = isSkipDbBuild()
    ? [[], 0, {} as Record<string, string>]
    : await Promise.all([
    prisma.galleryImage.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: LIMIT,
    }),
    prisma.galleryImage.count({ where }),
    getCMSContent(["kids_hero_headline", "kids_hero_subtext", "kids_hero_cta_label", "kids_page_description"]),
  ]);

  return (
    <main>
      <KidsGalleryPage
        initialImages={images}
        initialTotal={total}
        initialHasMore={total > LIMIT}
        heroHeadline={cmsGet(cms, "kids_hero_headline", "Dressed for little royals")}
        heroSubtext={cmsGet(
          cms,
          "kids_hero_subtext",
          "Occasion wear and everyday elegance for the smallest members of the house.",
        )}
        heroCtaLabel={cmsGet(cms, "kids_hero_cta_label", "Shop Kids")}
        pageDescription={cmsGet(
          cms,
          "kids_page_description",
          "Occasion wear and everyday elegance for the smallest members of the house.",
        )}
      />
    </main>
  );
}
