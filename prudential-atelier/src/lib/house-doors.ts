import { GalleryCategory, ProductCategory, ProductType } from "@prisma/client";
import { getCMSContent } from "@/lib/cms";
import { prisma } from "@/lib/prisma";
import { RTW_EXCLUDED_CATEGORIES } from "@/lib/rtw-aisle";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import { optimizeImageUrl } from "@/lib/utils";

export type HouseDoorCard = {
  href: string;
  title: string;
  subtitle: string;
  cta: string;
  imageUrl: string | null;
  imageAlt: string;
};

const DOORS = [
  {
    href: "/atelier",
    title: "The Atelier",
    subtitle: "Commissions designed around you.",
    cta: "Commission",
    cmsKey: "home_doors_atelier_image",
    appearanceKeys: ["img_atelier_portrait", "img_bespoke", "img_atelier_wide"] as const,
  },
  {
    href: "/bridal",
    title: "Bridal & Ceremony",
    subtitle: "Gowns for the day itself.",
    cta: "Bridal",
    cmsKey: "home_doors_bridal_image",
    appearanceKeys: ["img_collection_bridal", "img_bride_portrait", "img_bride_hero"] as const,
  },
  {
    href: "/rtw",
    title: "Ready-to-Wear",
    subtitle: "House signatures, cut when you order.",
    cta: "Shop",
    cmsKey: "home_doors_rtw_image",
    appearanceKeys: ["img_collection_rtw"] as const,
  },
] as const;

const SETTING_KEYS = [
  ...DOORS.map((d) => d.cmsKey),
  ...DOORS.flatMap((d) => d.appearanceKeys),
];

function isUsableHouseImage(url: string | null | undefined): url is string {
  const value = url?.trim();
  if (!value) return false;
  // Leftover appearance placeholders, not house photography.
  if (value.includes("images.unsplash.com")) return false;
  return true;
}

function firstUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (isUsableHouseImage(candidate)) return candidate.trim();
  }
  return null;
}

function withImage(
  door: (typeof DOORS)[number],
  url: string | null,
  alt?: string | null,
): HouseDoorCard {
  const imageUrl = url ? optimizeImageUrl(url, 960) : null;
  return {
    href: door.href,
    title: door.title,
    subtitle: door.subtitle,
    cta: door.cta,
    imageUrl,
    imageAlt: alt?.trim() || door.title,
  };
}

async function firstProductShot(where: {
  type?: ProductType;
  category?: ProductCategory;
  categoryNotIn?: ProductCategory[];
}): Promise<{ url: string; alt: string } | null> {
  const row = await prisma.product.findFirst({
    where: {
      isPublished: true,
      ...(where.type ? { type: where.type } : {}),
      ...(where.category ? { category: where.category } : {}),
      ...(where.categoryNotIn ? { category: { notIn: where.categoryNotIn } } : {}),
      images: { some: { url: { not: "" } } },
    },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    select: {
      name: true,
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
        select: { url: true, alt: true },
      },
    },
  });
  const image = row?.images[0];
  if (!image?.url?.trim()) return null;
  return { url: image.url, alt: image.alt?.trim() || row.name };
}

export async function getHouseDoors(): Promise<HouseDoorCard[]> {
  const empty = DOORS.map((door) => withImage(door, null));
  if (isSkipDbBuild()) return empty;

  try {
    const [cms, atelierGallery, bridalGallery, atelierProduct, bridalProduct, rtwProduct] = await Promise.all([
      getCMSContent([...SETTING_KEYS]),
      prisma.galleryImage.findFirst({
        where: { isPublished: true, category: GalleryCategory.ATELIER },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: { url: true, alt: true },
      }),
      prisma.galleryImage.findFirst({
        where: { isPublished: true, category: GalleryCategory.BRIDAL },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: { url: true, alt: true },
      }),
      firstProductShot({ type: ProductType.BESPOKE }),
      firstProductShot({ category: ProductCategory.BRIDAL }),
      firstProductShot({
        type: ProductType.RTW,
        categoryNotIn: [...RTW_EXCLUDED_CATEGORIES],
      }),
    ]);

    return [
      withImage(
        DOORS[0],
        firstUrl(cms[DOORS[0].cmsKey], ...DOORS[0].appearanceKeys.map((key) => cms[key]), atelierGallery?.url, atelierProduct?.url),
        atelierGallery?.alt || atelierProduct?.alt,
      ),
      withImage(
        DOORS[1],
        firstUrl(cms[DOORS[1].cmsKey], ...DOORS[1].appearanceKeys.map((key) => cms[key]), bridalGallery?.url, bridalProduct?.url),
        bridalGallery?.alt || bridalProduct?.alt,
      ),
      withImage(
        DOORS[2],
        firstUrl(cms[DOORS[2].cmsKey], ...DOORS[2].appearanceKeys.map((key) => cms[key]), rtwProduct?.url),
        rtwProduct?.alt,
      ),
    ];
  } catch {
    return empty;
  }
}
