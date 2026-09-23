import { GalleryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AtelierLandingPage } from "@/components/atelier/AtelierLandingPage";
import { getCMSContent } from "@/lib/cms";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import { cmsRouteMetadata } from "@/lib/seo";
import { groupAtelierPieces } from "@/lib/atelier-gallery";
import { CRAFT_STAGES, craftStageLineKey } from "@/lib/atelier-craft-stages";
import { resolveHeroCarouselItems } from "@/lib/hero-carousel";
import { withHeroVideoVariants } from "@/lib/hero-video-variants";
import { warmHeroWebmMp4 } from "@/lib/transcode-webm-mp4";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return cmsRouteMetadata("atelier", "/atelier");
}

const ATELIER_KEYS = [
  "atelier_hero_media",
  "atelier_hero_headline",
  "atelier_hero_subtext",
  "atelier_hero_cta_label",
  "atelier_process_headline",
  "atelier_process_subtext",
  "atelier_gallery_label",
  "atelier_gallery_headline",
  "atelier_cta_headline",
  "atelier_cta_button_label",
  ...CRAFT_STAGES.map(craftStageLineKey),
];

/** Enough rows to assemble a dozen pieces from several frames each. */
const GALLERY_ROWS = 80;

export default async function AtelierPage() {
  const [galleryRows, reviews, cms] = isSkipDbBuild()
    ? [[], [], {} as Record<string, string>]
    : await Promise.all([
    prisma.galleryImage.findMany({
      where: { isPublished: true, category: GalleryCategory.ATELIER },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: GALLERY_ROWS,
      select: {
        id: true,
        url: true,
        alt: true,
        caption: true,
        description: true,
        pieceOfId: true,
        priceFloorNGN: true,
        priceCeilingNGN: true,
      },
    }),
    prisma.review.findMany({
      where: { isApproved: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        user: { select: { name: true } },
      },
    }),
    getCMSContent([...ATELIER_KEYS]),
  ]);

  // BB1: the house's photograph or film (Admin → Content → Atelier). A film gets a
  // poster and a phone-sized encode, exactly as on /rtw.
  const heroItems = withHeroVideoVariants(resolveHeroCarouselItems(cms.atelier_hero_media));
  for (const item of heroItems) if (item.type === "video") warmHeroWebmMp4(item.url);

  return (
    <main>
      <AtelierLandingPage
        heroItems={heroItems}
        pieces={groupAtelierPieces(galleryRows)}
        reviews={reviews.map((r) => ({
          id: r.id,
          clientName: r.user.name ?? "Client",
          rating: r.rating,
          title: r.title,
          body: r.body ?? "",
        }))}
        cms={cms}
      />
    </main>
  );
}
