import type { LoyaltyTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type HomepageTestimonial = {
  id: string;
  rating: number;
  body: string | null;
  userName: string;
  subtitle: string | null;
  imageUrl: string | null;
  isAnonymous: boolean;
};

const testimonialInclude = {
  user: {
    select: {
      name: true,
      image: true,
      clientProfile: { select: { loyaltyTier: true } },
    },
  },
} as const;

type TestimonialRow = Awaited<
  ReturnType<typeof prisma.testimonial.findMany<{ include: typeof testimonialInclude }>>
>[number];

function resolveImageUrl(
  adminImage: string | null | undefined,
  clientImage: string | null | undefined,
  userImage: string | null | undefined,
): string | null {
  if (adminImage?.trim()) return adminImage;
  if (clientImage?.trim()) return clientImage;
  if (userImage?.trim()) return userImage;
  return null;
}

export function getDisplayName(testimonial: {
  user?: { name: string | null } | null;
  displayName?: string | null;
}): string {
  if (testimonial.user?.name) {
    const parts = testimonial.user.name.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]}.` : parts[0]!;
  }
  return testimonial.displayName?.trim() || "Valued Client";
}

export function getSubLabel(testimonial: {
  user?: { clientProfile?: { loyaltyTier: LoyaltyTier | null } | null } | null;
  location?: string | null;
  productContext?: string | null;
  orderContext?: string | null;
}): string | null {
  const context = [testimonial.productContext, testimonial.orderContext].filter(Boolean).join(" · ");
  const tier = formatLoyaltyTier(testimonial.user?.clientProfile?.loyaltyTier ?? null);

  if (tier) {
    return [tier, context].filter(Boolean).join(" · ") || null;
  }

  if (testimonial.location?.trim()) {
    return [testimonial.location.trim(), context].filter(Boolean).join(" · ") || null;
  }

  return context || null;
}

function mapTestimonial(t: TestimonialRow): HomepageTestimonial {
  return {
    id: t.id,
    rating: t.rating,
    body: t.body,
    userName: getDisplayName(t),
    subtitle: getSubLabel(t),
    imageUrl: resolveImageUrl(t.adminImage, t.clientImage, t.user?.image),
    isAnonymous: !t.userId,
  };
}

/** Curated fallbacks when no approved testimonials exist yet (e.g. before demo seed). */
export const FALLBACK_TESTIMONIALS: HomepageTestimonial[] = [
  {
    id: "fallback-1",
    rating: 5,
    body: "Prudential Atelier didn't just make me a dress — they made me feel like the woman I always knew I was. From the first consultation to the final fitting, every detail was handled with such grace and precision.",
    userName: "Chisom Eze",
    subtitle: "Platinum member · Chieftaincy Ceremony Wrapper Set · Atelier Commission",
    imageUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400",
    isAnonymous: false,
  },
  {
    id: "fallback-2",
    rating: 5,
    body: "I have bought luxury fashion from London, Paris, and Dubai. Nothing compares to the experience of walking into the Prudential atelier and having something made entirely for you.",
    userName: "Sandra Dike",
    subtitle: "Gold member · Custom Evening Gown · Atelier Commission",
    imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
    isAnonymous: false,
  },
  {
    id: "fallback-3",
    rating: 5,
    body: "My consultation with Mrs. Prudent was unlike anything I expected. She listened to everything — not just what I said, but what I meant.",
    userName: "Amaka Nwosu",
    subtitle: "Gold member · Custom Asoebi Gown · In-Person Consultation",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
    isAnonymous: false,
  },
];

/** Approved testimonials for the homepage — homepage-flagged first, then recent approved. */
export async function getHomepageTestimonials(limit = 6): Promise<HomepageTestimonial[]> {
  if (process.env.SKIP_DB_BUILD === "1") return FALLBACK_TESTIMONIALS.slice(0, limit);

  try {
  const flagged = await prisma.testimonial.findMany({
    where: { isApproved: true, showOnHomepage: true },
    include: testimonialInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  let rows = [...flagged];

  if (rows.length < limit) {
    const excludeIds = rows.map((r) => r.id);
    const filler = await prisma.testimonial.findMany({
      where: {
        isApproved: true,
        id: excludeIds.length ? { notIn: excludeIds } : undefined,
      },
      include: testimonialInclude,
      orderBy: { createdAt: "desc" },
      take: limit - rows.length,
    });
    rows = [...rows, ...filler];
  }

  const mapped = rows.map(mapTestimonial);
  if (mapped.length > 0) return mapped;

  return FALLBACK_TESTIMONIALS.slice(0, limit);
  } catch {
    return FALLBACK_TESTIMONIALS.slice(0, limit);
  }
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
