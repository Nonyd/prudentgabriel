import { GalleryCategory } from "@prisma/client";
import { cmsBool, cmsGet, getCMSContent } from "@/lib/cms";
import { prisma } from "@/lib/prisma";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import { HomeGalleryBand, type BandImage } from "@/components/public/HomeGalleryBand";

const TAKE = 4;
export const HOME_ATELIER_IMAGE_KEYS = [
  "home_atelier_image_1",
  "home_atelier_image_2",
  "home_atelier_image_3",
  "home_atelier_image_4",
] as const;

/**
 * Sits under the Bridal band. The four pictures are chosen in Content → Homepage →
 * Atelier band; with none chosen it shows the latest published Atelier gallery photos.
 */
export async function HomeAtelierBand() {
  let images: BandImage[] = [];
  let cms: Record<string, string> = {};

  try {
    if (!isSkipDbBuild()) {
      cms = await getCMSContent([
        "home_atelier_enabled",
        "home_atelier_headline",
        "home_atelier_subtext",
        "home_atelier_cta_label",
        ...HOME_ATELIER_IMAGE_KEYS,
      ]);
      const headline = cmsGet(cms, "home_atelier_headline", "Atelier");
      images = HOME_ATELIER_IMAGE_KEYS.map((key) => cmsGet(cms, key, "").trim())
        .filter(Boolean)
        .map((url, i) => ({ id: `chosen-${i}`, url, alt: headline }));
      if (images.length === 0) {
        images = await prisma.galleryImage.findMany({
          where: { isPublished: true, category: GalleryCategory.ATELIER },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          take: TAKE,
          select: { id: true, url: true, alt: true },
        });
      }
    }
  } catch {
    return null;
  }

  if (!cmsBool(cms, "home_atelier_enabled", true)) return null;
  if (images.length === 0) return null;

  return (
    <HomeGalleryBand
      headline={cmsGet(cms, "home_atelier_headline", "Atelier")}
      subtext={cmsGet(cms, "home_atelier_subtext", "Made to measure, made for you.")}
      cta={cmsGet(cms, "home_atelier_cta_label", "See atelier")}
      href="/atelier"
      images={images}
    />
  );
}
