import type { ProductCategory, ProductType } from "@prisma/client";

export interface ProductListImage {
  url: string;
  alt: string | null;
  isPrimary: boolean;
}

export interface ProductListVariant {
  id: string;
  size: string;
  priceNGN: number;
  salePriceNGN: number | null;
  stock: number;
}

export interface ProductListColor {
  id: string;
  name: string;
  hex: string;
  imageUrl?: string | null;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: ProductCategory;
  type: ProductType;
  basePriceNGN: number;
  isOnSale: boolean;
  isNewArrival: boolean;
  isBespokeAvail: boolean;
  isFeatured: boolean;
  tags: string[];
  images: ProductListImage[];
  variants: ProductListVariant[];
  colors: ProductListColor[];
  _count: { reviews: number };
}
