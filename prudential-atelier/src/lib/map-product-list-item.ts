import type { ProductListItem, ProductListOptionGroup, ProductListVariant } from "@/types/product";
import { derivedCatalogMinNGN } from "@/lib/pricing";

export const listOptionGroupSelect = {
  select: {
    id: true,
    label: true,
    isRequired: true,
    includeInSku: true,
    options: {
      orderBy: { sortOrder: "asc" as const },
      select: {
        id: true,
        label: true,
        priceAdjustmentNGN: true,
        isDefault: true,
        sortOrder: true,
        skuPart: true,
      },
    },
  },
} as const;

export function mapListOptionGroup(
  group?: {
    id: string;
    label: string;
    isRequired: boolean;
    includeInSku: boolean;
    options: Array<{
      id: string;
      label: string;
      priceAdjustmentNGN: number;
      isDefault: boolean;
      sortOrder: number;
      skuPart?: string | null;
    }>;
  } | null,
): ProductListOptionGroup | null {
  if (!group || group.options.length === 0) return null;
  return {
    id: group.id,
    label: group.label,
    isRequired: group.isRequired,
    includeInSku: group.includeInSku,
    options: group.options.map((o) => ({
      id: o.id,
      label: o.label,
      priceAdjustmentNGN: o.priceAdjustmentNGN,
      isDefault: o.isDefault,
      sortOrder: o.sortOrder,
      skuPart: o.skuPart ?? null,
    })),
  };
}

export function mapListVariant(v: {
  id: string;
  size: string;
  priceNGN: number;
  salePriceNGN: number | null;
  priceUSD?: number | null;
  priceGBP?: number | null;
}): ProductListVariant {
  return {
    id: v.id,
    size: v.size,
    priceNGN: v.priceNGN,
    salePriceNGN: v.salePriceNGN,
    priceUSD: v.priceUSD ?? null,
    priceGBP: v.priceGBP ?? null,
  };
}

export function mapProductToListItem(p: {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: ProductListItem["category"];
  type: ProductListItem["type"];
  basePriceNGN: number;
  priceUSD?: number | null;
  priceGBP?: number | null;
  isOnSale: boolean;
  isNewArrival: boolean;
  isBespokeAvail: boolean;
  isFeatured: boolean;
  tags: string[];
  images: { url: string; alt: string | null; isPrimary: boolean }[];
  variants: {
    id: string;
    size: string;
    priceNGN: number;
    salePriceNGN: number | null;
    priceUSD?: number | null;
    priceGBP?: number | null;
  }[];
  colors: { id: string; name: string; hex: string; imageUrl?: string | null }[];
  _count: { reviews: number };
  customOffered?: boolean;
  optionGroup?: ProductListOptionGroup | null;
}): ProductListItem {
  const optionGroup = mapListOptionGroup(p.optionGroup ?? null);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    type: p.type,
    basePriceNGN: p.variants.length
      ? derivedCatalogMinNGN(p.variants, p.isOnSale, optionGroup?.options)
      : p.basePriceNGN,
    priceUSD: p.priceUSD ?? null,
    priceGBP: p.priceGBP ?? null,
    isOnSale: p.isOnSale,
    isNewArrival: p.isNewArrival,
    isBespokeAvail: p.isBespokeAvail,
    isFeatured: p.isFeatured,
    tags: p.tags,
    images: p.images.map((im) => ({
      url: im.url,
      alt: im.alt,
      isPrimary: im.isPrimary,
    })),
    variants: p.variants.map(mapListVariant),
    colors: p.colors,
    _count: p._count,
    customOffered: p.customOffered ?? false,
    optionGroup,
  };
}
