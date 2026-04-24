import { ProductCategory, ProductType } from "@prisma/client";
import { z } from "zod";

function optNonNegNumber() {
  return z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return undefined;
    return n;
  }, z.number().min(0).optional());
}

const variantSchema = z.object({
  id: z.string().optional(),
  size: z.string().min(1),
  sku: z.string().min(1),
  priceNGN: z.coerce.number().min(0),
  priceUSD: optNonNegNumber(),
  priceGBP: optNonNegNumber(),
  salePriceNGN: z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    return n;
  }, z.number().min(0).nullable().optional()),
  stock: z.coerce.number().int().min(0),
  lowStockAt: z.coerce.number().int().min(0).default(3),
  sortOrder: z.coerce.number().int().default(0),
});

const colorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  imageUrl: z.string().url().optional().nullable(),
});

const imageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const productAdminSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  details: z.string().optional(),
  category: z.nativeEnum(ProductCategory),
  type: z.nativeEnum(ProductType),
  tags: z.array(z.string()).default([]),
  basePriceNGN: z.coerce.number().positive(),
  basePriceUSD: optNonNegNumber(),
  basePriceGBP: optNonNegNumber(),
  isOnSale: z.boolean().default(false),
  saleEndsAt: z.coerce.date().optional().nullable(),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBespokeAvail: z.boolean().default(false),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  variants: z.array(variantSchema).min(1),
  colors: z.array(colorSchema).default([]),
  images: z.array(imageSchema).default([]),
  bundleProductIds: z.array(z.string()).max(4).default([]),
});

export const productToggleSchema = z.object({
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
});

export type ProductAdminInput = z.infer<typeof productAdminSchema>;
