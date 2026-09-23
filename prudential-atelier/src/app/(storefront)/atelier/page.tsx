import { GalleryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AtelierLandingPage } from "@/components/atelier/AtelierLandingPage";
import { getCMSContent } from "@/lib/cms";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import { cmsRouteMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return cmsRouteMetadata("atelier", "/atelier");
}

const ATELIER_KEYS = [
  "atelier_hero_headline",
  "atelier_hero_subtext",
  "atelier_hero_cta_label",
  "atelier_process_headline",
  "atelier_process_subtext",
  "atelier_gallery_label",
  "atelier_gallery_headline",
  "atelier_cta_headline",
  "atelier_cta_button_label",
] as const;

export default async function AtelierPage() {
  const [galleryImages, reviews, cms] = isSkipDbBuild()
    ? [[], [], {} as Record<string, string>]
    : await Promise.all([
    prisma.galleryImage.findMany({
      where: { isPublished: true, category: GalleryCategory.ATELIER },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 8,
      select: { id: true, url: true, alt: true, caption: true, priceFloorNGN: true, priceCeilingNGN: true },
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

  return (
    <main>
      <AtelierLandingPage
        galleryImages={galleryImages}
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
