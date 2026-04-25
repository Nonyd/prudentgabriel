import type { Metadata } from "next";
import { GalleryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AtelierGalleryClient } from "@/components/gallery/AtelierGalleryClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "The Atelier | Prudent Gabriel",
  description: "Step inside our Lagos atelier — craft, hands, and story behind every Prudent Gabriel piece.",
};

const LIMIT = 24;

export default async function AtelierPage() {
  const where = { isPublished: true, category: GalleryCategory.ATELIER };
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
      <AtelierGalleryClient initialImages={images} initialTotal={total} initialHasMore={hasMore} />
    </main>
  );
}
