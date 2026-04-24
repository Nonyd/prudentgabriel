import type { ProductListItem } from "@/types/product";

export function mapProductToListItem(p: {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: ProductListItem["category"];
  type: ProductListItem["type"];
  basePriceNGN: number;
  isOnSale: boolean;
  isNewArrival: boolean;
  isBespokeAvail: boolean;
  isFeatured: boolean;
  tags: string[];
  images: { url: string; alt: string | null; isPrimary: boolean }[];
  variants: { id: string; size: string; priceNGN: number; salePriceNGN: number | null; stock: number }[];
  colors: { id: string; name: string; hex: string }[];
  _count: { reviews: number };
}): ProductListItem {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    type: p.type,
    basePriceNGN: p.basePriceNGN,
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
    variants: p.variants.map((v) => ({
      id: v.id,
      size: v.size,
      priceNGN: v.priceNGN,
      salePriceNGN: v.salePriceNGN,
      stock: v.stock,
    })),
    colors: p.colors,
    _count: p._count,
  };
}
