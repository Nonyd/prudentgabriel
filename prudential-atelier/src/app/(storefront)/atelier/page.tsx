import type { Metadata } from "next";
import { GalleryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AtelierLandingPage } from "@/components/atelier/AtelierLandingPage";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "The Atelier | Prudent Gabriel",
  description:
    "Every commission begins with a conversation. Bespoke couture designed entirely around you at the Prudent Gabriel atelier in Lagos.",
};

export default async function AtelierPage() {
  const [galleryImages, reviews] = await Promise.all([
    prisma.galleryImage.findMany({
      where: { isPublished: true, category: GalleryCategory.ATELIER },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 8,
      select: { id: true, url: true, alt: true, caption: true },
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
      />
    </main>
  );
}
