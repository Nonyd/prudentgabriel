import type { Metadata } from "next";
import { GalleryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { KidsGalleryPage } from "@/components/gallery/KidsGalleryPage";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Prudential Kids | Prudent Gabriel",
  description: "Luxury fashion for the little ones.",
};

const LIMIT = 24;

export default async function KidsPage() {
  const where = { isPublished: true, category: GalleryCategory.KIDS };
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
      <KidsGalleryPage initialImages={images} initialTotal={total} initialHasMore={total > LIMIT} />
    </main>
  );
}
