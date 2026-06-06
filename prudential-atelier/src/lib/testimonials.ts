import type { LoyaltyTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type HomepageTestimonial = {
  id: string;
  rating: number;
  body: string | null;
  userName: string;
  loyaltyTier: LoyaltyTier | null;
  productName: string;
  imageUrl: string | null;
};

const reviewInclude = {
  user: {
    select: {
      name: true,
      image: true,
      clientProfile: { select: { loyaltyTier: true } },
    },
  },
  product: {
    select: {
      name: true,
      images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } },
    },
  },
} as const;

type ReviewRow = Awaited<ReturnType<typeof prisma.review.findMany<{ include: typeof reviewInclude }>>>[number];

function resolveImageUrl(
  userImage: string | null | undefined,
  productImage: string | null | undefined,
  testimonialImage: string | null | undefined,
): string | null {
  if (userImage?.trim()) return userImage;
  if (productImage?.trim()) return productImage;
  if (testimonialImage?.trim()) return testimonialImage;
  return null;
}

function mapReview(r: ReviewRow): HomepageTestimonial {
  const productImage = r.product.images[0]?.url ?? null;
  return {
    id: r.id,
    rating: r.rating,
    body: r.body,
    userName: r.user.name ?? "Client",
    loyaltyTier: r.user.clientProfile?.loyaltyTier ?? null,
    productName: r.product.name,
    imageUrl: resolveImageUrl(r.user.image, productImage, r.testimonialImage),
  };
}

/** Curated fallbacks when no approved reviews exist yet (e.g. before demo seed). */
export const FALLBACK_TESTIMONIALS: HomepageTestimonial[] = [
  {
    id: "fallback-1",
    rating: 5,
    body: "Mrs. Gabriel-Okopi understood my vision completely. The fabric quality, the beading, the fit — everything was perfect. I received so many compliments. I will never go anywhere else.",
    userName: "Sandra Dike",
    loyaltyTier: "GOLD",
    productName: "Nneka Aso-Ebi Set",
    imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400",
  },
  {
    id: "fallback-2",
    rating: 5,
    body: "The attention to detail is unmatched. From the consultation to the final delivery, the entire experience felt truly luxurious. My bridal gown was a masterpiece.",
    userName: "Chisom Eze",
    loyaltyTier: "PLATINUM",
    productName: "The Zahra Bridal Gown",
    imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400",
  },
  {
    id: "fallback-3",
    rating: 5,
    body: "The Lagos Power Suit made me walk into that boardroom and own every second. The tailoring is sharper than anything I have bought abroad. Nigerian excellence at its finest.",
    userName: "Chidinma E.",
    loyaltyTier: "SILVER",
    productName: "Executive Power Suit",
    imageUrl: "https://images.unsplash.com/photo-1566174053879-435285eff2e8?w=800&q=80",
  },
  {
    id: "fallback-4",
    rating: 5,
    body: "From my first consultation to the delivery of my bespoke piece, everything was handled with such professionalism and heart. This brand is the future of Nigerian fashion.",
    userName: "Temi A.",
    loyaltyTier: "GOLD",
    productName: "Bespoke Commission",
    imageUrl: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&q=80",
  },
];

/** Approved reviews for the homepage — homepage-flagged first, then recent approved. */
export async function getHomepageTestimonials(limit = 6): Promise<HomepageTestimonial[]> {
  const flagged = await prisma.review.findMany({
    where: { isApproved: true, showOnHomepage: true },
    include: reviewInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  let rows = [...flagged];

  if (rows.length < limit) {
    const excludeIds = rows.map((r) => r.id);
    const filler = await prisma.review.findMany({
      where: {
        isApproved: true,
        id: excludeIds.length ? { notIn: excludeIds } : undefined,
      },
      include: reviewInclude,
      orderBy: { createdAt: "desc" },
      take: limit - rows.length,
    });
    rows = [...rows, ...filler];
  }

  const mapped = rows.map(mapReview);
  if (mapped.length > 0) return mapped;

  return FALLBACK_TESTIMONIALS.slice(0, limit);
}

export function formatLoyaltyTier(tier: LoyaltyTier | null): string | null {
  if (!tier) return null;
  const labels: Record<LoyaltyTier, string> = {
    BRONZE: "Bronze member",
    SILVER: "Silver member",
    GOLD: "Gold member",
    PLATINUM: "Platinum member",
  };
  return labels[tier];
}
