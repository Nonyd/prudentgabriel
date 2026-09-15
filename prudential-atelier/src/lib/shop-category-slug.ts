import slugify from "slugify";

export const UNCATEGORIZED_SLUG = "UNCATEGORIZED";

export const SEED_SHOP_CATEGORIES: Array<{
  slug: string;
  label: string;
  sortOrder: number;
  locked: boolean;
}> = [
  { slug: "BRIDAL", label: "Bridal", sortOrder: 10, locked: false },
  { slug: "EVENING_WEAR", label: "Evening Wear", sortOrder: 20, locked: false },
  { slug: "FORMAL", label: "Formal", sortOrder: 30, locked: false },
  { slug: "CASUAL", label: "Casual", sortOrder: 40, locked: false },
  { slug: "KIDDIES", label: "Kiddies", sortOrder: 50, locked: false },
  { slug: "ACCESSORIES", label: "Accessories", sortOrder: 60, locked: false },
  { slug: UNCATEGORIZED_SLUG, label: "Uncategorized", sortOrder: 999, locked: true },
];

/** Seed aisle slugs. Prisma does not emit unused schema enums to the client. */
export const ProductCategory = {
  BRIDAL: "BRIDAL",
  EVENING_WEAR: "EVENING_WEAR",
  CASUAL: "CASUAL",
  FORMAL: "FORMAL",
  KIDDIES: "KIDDIES",
  ACCESSORIES: "ACCESSORIES",
} as const;

export type ProductCategory = (typeof ProductCategory)[keyof typeof ProductCategory];

export function slugFromCategoryLabel(label: string): string {
  return slugify(label, { replacement: "_", strict: true, trim: true })
    .toUpperCase()
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export class ShopCategoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ShopCategoryError";
  }
}
