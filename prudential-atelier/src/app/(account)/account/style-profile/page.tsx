import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { StyleProfileClient } from "@/components/account/StyleProfileClient";
import { mapProductToListItem } from "@/lib/map-product-list-item";

const BUDGET_RANGES: Record<string, [number, number]> = {
  "₦50k–₦150k": [50000, 150000],
  "₦150k–₦350k": [150000, 350000],
  "₦350k–₦750k": [350000, 750000],
  "₦750k+": [750000, 999_999_999],
};

export default async function StyleProfilePage() {
  const session = await auth();
  const profile = await getOrCreateClientProfile(session!.user!.id!);

  let picks = await prisma.product.findMany({
    where: { isPublished: true },
    take: 4,
    orderBy: { isFeatured: "desc" },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
      colors: true,
      _count: { select: { reviews: true } },
    },
  });

  if (profile.budgetRange && BUDGET_RANGES[profile.budgetRange]) {
    const [min, max] = BUDGET_RANGES[profile.budgetRange]!;
    const filtered = await prisma.product.findMany({
      where: {
        isPublished: true,
        priceNGN: { gte: min, lte: max },
        ...(profile.preferredColors.length
          ? { tags: { hasSome: profile.preferredColors.map((c) => c.toLowerCase()) } }
          : {}),
      },
      take: 4,
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { sortOrder: "asc" } },
        colors: true,
        _count: { select: { reviews: true } },
      },
    });
    if (filtered.length) picks = filtered;
  }

  return <StyleProfileClient profile={profile} picks={picks.map(mapProductToListItem)} />;
}
