import type { Metadata } from "next";
import { GalleryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BridalGalleryClient } from "@/components/gallery/BridalGalleryClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Bridesals | Prudential Bride | Prudent Gabriel",
  description: "Prudential Bride gallery — couture bridal moments from our Lagos atelier.",
};

const LIMIT = 50;

export default async function BridesalsPage() {
  const where = { isPublished: true, category: GalleryCategory.BRIDAL };
  const [images, total] = await Promise.all([
    prisma.galleryImage.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: LIMIT,
    }),
    prisma.galleryImage.count({ where }),
  ]);
  const hasMore = total > LIMIT;

  return (
    <main>
      <BridalGalleryClient initialImages={images} initialTotal={total} initialHasMore={hasMore} />
    </main>
  );
}
