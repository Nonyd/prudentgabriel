import { GalleryCategory } from "@prisma/client";
import { cmsBool, cmsGet, getCMSContent } from "@/lib/cms";
import { prisma } from "@/lib/prisma";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import { HomeGalleryBand, type BandImage } from "@/components/public/HomeGalleryBand";

const TAKE = 4;

export async function HomeBridalBand() {
  let images: BandImage[] = [];
  let cms: Record<string, string> = {};

  try {
    if (!isSkipDbBuild()) {
      const [rows, content] = await Promise.all([
        prisma.galleryImage.findMany({
          where: { isPublished: true, category: GalleryCategory.BRIDAL },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          take: TAKE,
          select: { id: true, url: true, alt: true },
        }),
        getCMSContent([
          "home_bridal_enabled",
          "home_bridal_headline",
          "home_bridal_subtext",
          "home_bridal_cta_label",
        ]),
      ]);
      images = rows;
      cms = content;
    }
  } catch {
    return null;
  }

  if (!cmsBool(cms, "home_bridal_enabled", true)) return null;
  if (images.length === 0) return null;

  return (
    <HomeGalleryBand
      headline={cmsGet(cms, "home_bridal_headline", "Bridal")}
      subtext={cmsGet(cms, "home_bridal_subtext", "Gowns for the day itself.")}
      cta={cmsGet(cms, "home_bridal_cta_label", "See bridal")}
      href="/bridal"
      images={images}
    />
  );
}
