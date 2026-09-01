import type { ProductListItem, ProductListVariant } from "@/types/product";
import { derivedCatalogMinNGN } from "@/lib/pricing";

export function mapListVariant(v: {
  id: string;
  size: string;
  priceNGN: number;
  salePriceNGN: number | null;
  priceUSD?: number | null;
  priceGBP?: number | null;
  stock: number;
}): ProductListVariant {
  return {
    id: v.id,
    size: v.size,
    priceNGN: v.priceNGN,
    salePriceNGN: v.salePriceNGN,
    priceUSD: v.priceUSD ?? null,
    priceGBP: v.priceGBP ?? null,
    stock: v.stock,
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
    stock: number;
  }[];
  colors: { id: string; name: string; hex: string; imageUrl?: string | null }[];
  _count: { reviews: number };
  customOffered?: boolean;
}): ProductListItem {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    type: p.type,
    basePriceNGN: p.variants.length ? derivedCatalogMinNGN(p.variants, p.isOnSale) : p.basePriceNGN,
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
  };
}
