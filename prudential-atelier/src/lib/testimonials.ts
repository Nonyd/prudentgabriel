import type { LoyaltyTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type HomepageTestimonial = {
  id: string;
  rating: number;
  body: string | null;
  userName: string;
  loyaltyTier: LoyaltyTier | null;
  productName: string;
};

const reviewInclude = {
  user: {
    include: {
      clientProfile: { select: { loyaltyTier: true } },
    },
  },
  product: { select: { name: true } },
} as const;

function mapReview(
  r: Awaited<ReturnType<typeof prisma.review.findMany<{ include: typeof reviewInclude }>>>[number],
): HomepageTestimonial {
  return {
    id: r.id,
    rating: r.rating,
    body: r.body,
    userName: r.user.name ?? "Client",
    loyaltyTier: r.user.clientProfile?.loyaltyTier ?? null,
    productName: r.product.name,
  };
}

/** Up to 3 approved reviews for the homepage — homepage-flagged first, then recent approved. */
export async function getHomepageTestimonials(limit = 3): Promise<HomepageTestimonial[]> {
  const flagged = await prisma.review.findMany({
    where: { isApproved: true, showOnHomepage: true },
    include: reviewInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  if (flagged.length >= limit) {
    return flagged.map(mapReview);
  }

  const excludeIds = flagged.map((r) => r.id);
  const filler = await prisma.review.findMany({
    where: {
      isApproved: true,
      id: excludeIds.length ? { notIn: excludeIds } : undefined,
    },
    include: reviewInclude,
    orderBy: { createdAt: "desc" },
    take: limit - flagged.length,
  });

  return [...flagged, ...filler].map(mapReview);
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
