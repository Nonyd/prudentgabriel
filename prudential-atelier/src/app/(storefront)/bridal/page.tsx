import type { Metadata } from "next";
import { GalleryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BridalGalleryPage } from "@/components/gallery/BridalGalleryPage";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Prudential Bride | Prudent Gabriel",
  description: "Every bride is a masterpiece. Explore the Prudential Bride collection.",
};

const LIMIT = 24;

export default async function BridalPage() {
  const where = { isPublished: true, category: GalleryCategory.BRIDAL };
  const [images, total] = await Promise.all([
    prisma.galleryImage.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: LIMIT,
    }),
    prisma.galleryImage.count({ where }),
  ]);

  return (
    <main>
      <BridalGalleryPage initialImages={images} initialTotal={total} initialHasMore={total > LIMIT} />
    </main>
  );
}
