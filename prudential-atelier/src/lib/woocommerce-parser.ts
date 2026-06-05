import Papa from "papaparse";
import type { ProductCategory } from "@prisma/client";
import { slugifyText } from "@/lib/utils";

type CsvRow = Record<string, string | undefined>;

export interface ParsedVariant {
  size: string;
  color?: string;
  price: number;
  sku?: string;
}

export interface ParsedProduct {
  wcId: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  images: string[];
  category: ProductCategory;
  tags: string[];
  variants: ParsedVariant[];
  minPrice: number;
  sizes: string[];
  colors: string[];
  isImportable: boolean;
  skipReason?: string;
}

function pick(row: CsvRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}

function cleanText(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function parseImageUrls(imageRaw: string): string[] {
  return imageRaw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

function parsePrice(row: CsvRow): number {
  const sale = pick(row, ["Sale price", "sale_price"]);
  const regular = pick(row, ["Regular price", "regular_price", "Price", "price"]);
  const raw = sale || regular;
  const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseTags(row: CsvRow): string[] {
  const raw = pick(row, ["Tags", "tags"]);
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function mapCategory(wcCategories: string): ProductCategory {
  const cats = wcCategories.toLowerCase();
  if (cats.includes("bridal") || cats.includes("bride")) return "BRIDAL";
  if (cats.includes("kids") || cats.includes("kiddies") || cats.includes("children")) return "KIDDIES";
  if (cats.includes("suit") || cats.includes("3-piece") || cats.includes("2-piece")) return "FORMAL";
  if (cats.includes("dress")) return "CASUAL";
  if (cats.includes("jump")) return "CASUAL";
  if (cats.includes("accessories") || cats.includes("bag")) return "ACCESSORIES";
  if (cats.includes("evening")) return "EVENING_WEAR";
  return "CASUAL";
}

export function generateSlug(name: string): string {
  return slugifyText(name);
}

function normalizeParentRef(parent: string): string {
  return parent.replace(/^id:/i, "").trim();
}

function extractSize(row: CsvRow): string {
  for (let i = 1; i <= 3; i += 1) {
    const attrName = pick(row, [`Attribute ${i} name`, `attribute_${i}_name`]).toLowerCase();
    const attrVal = pick(row, [`Attribute ${i} value(s)`, `Attribute ${i} values`, `attribute_${i}_value(s)`]);
    if (attrName.includes("size") && attrVal) return attrVal;
  }
  const size = pick(row, ["Size", "size"]);
  return size || "One Size";
}

function extractColor(row: CsvRow): string | undefined {
  for (let i = 1; i <= 3; i += 1) {
    const attrName = pick(row, [`Attribute ${i} name`, `attribute_${i}_name`]).toLowerCase();
    const attrVal = pick(row, [`Attribute ${i} value(s)`, `Attribute ${i} values`, `attribute_${i}_value(s)`]);
    if ((attrName.includes("color") || attrName.includes("colour")) && attrVal) return attrVal;
  }
  const color = pick(row, ["Color", "colour", "Colour"]);
  return color || undefined;
}

function getRowType(row: CsvRow): string {
  return pick(row, ["Type", "type"]).toLowerCase();
}

function buildVariant(row: CsvRow): ParsedVariant | null {
  const price = parsePrice(row);
  if (price <= 0) return null;
  return {
    size: extractSize(row),
    color: extractColor(row),
    price,
    sku: pick(row, ["SKU", "sku"]) || undefined,
  };
}

function assessImportable(product: Omit<ParsedProduct, "isImportable" | "skipReason">): {
  isImportable: boolean;
  skipReason?: string;
} {
  if (product.images.length === 0) {
    return { isImportable: false, skipReason: "No images" };
  }
  if (!product.description && !product.shortDescription) {
    return { isImportable: false, skipReason: "No description" };
  }
  if (product.variants.length === 0) {
    return { isImportable: false, skipReason: "No priced variations" };
  }
  return { isImportable: true };
}

export function parseWooCommerceCSV(csvText: string): ParsedProduct[] {
  const result = Papa.parse<CsvRow>(csvText, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    throw new Error("Invalid CSV format");
  }

  const rows = result.data;
  const parents = new Map<string, CsvRow>();
  const variationsByParent = new Map<string, CsvRow[]>();
  const simpleProducts: CsvRow[] = [];

  for (const row of rows) {
    const type = getRowType(row);
    const id = pick(row, ["ID", "id"]);
    const parentRef = normalizeParentRef(pick(row, ["Parent", "parent"]));

    if (type === "variation" && parentRef) {
      const list = variationsByParent.get(parentRef) ?? [];
      list.push(row);
      variationsByParent.set(parentRef, list);
    } else if (type === "variable" && id) {
      parents.set(id, row);
    } else if (type === "simple" || !type) {
      const name = pick(row, ["Name", "name", "post_title"]);
      if (name) simpleProducts.push(row);
    } else if (id && !parentRef) {
      // Some exports mark parents without explicit "variable" type
      const name = pick(row, ["Name", "name", "post_title"]);
      if (name) parents.set(id, row);
    }
  }

  const products: ParsedProduct[] = [];

  for (const [parentId, parentRow] of Array.from(parents.entries())) {
    const name = pick(parentRow, ["Name", "name", "post_title"]).trim();
    if (!name) continue;

    const images = parseImageUrls(pick(parentRow, ["Images", "images", "image"]));
    const description = cleanText(pick(parentRow, ["Description", "description"]));
    const shortDescription = cleanText(pick(parentRow, ["Short description", "short_description"]));
    const categories = pick(parentRow, ["Categories", "categories"]);
    const variationRows = variationsByParent.get(parentId) ?? [];

    const variants: ParsedVariant[] = [];
    for (const vRow of variationRows) {
      const variant = buildVariant(vRow);
      if (variant) variants.push(variant);
    }

    // Parent may have a price if no variations
    if (variants.length === 0) {
      const parentVariant = buildVariant(parentRow);
      if (parentVariant) variants.push(parentVariant);
    }

    const sizes = Array.from(new Set(variants.map((v) => v.size)));
    const colors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean) as string[]));
    const minPrice = variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0;

    const base = {
      wcId: parentId,
      name,
      slug: generateSlug(name),
      shortDescription,
      description,
      images,
      category: mapCategory(categories),
      tags: parseTags(parentRow),
      variants,
      minPrice,
      sizes,
      colors,
    };

    const { isImportable, skipReason } = assessImportable(base);
    products.push({ ...base, isImportable, skipReason });
  }

  for (const row of simpleProducts) {
    const name = pick(row, ["Name", "name", "post_title"]).trim();
    if (!name) continue;

    const images = parseImageUrls(pick(row, ["Images", "images", "image"]));
    const description = cleanText(pick(row, ["Description", "description"]));
    const shortDescription = cleanText(pick(row, ["Short description", "short_description"]));
    const categories = pick(row, ["Categories", "categories"]);
    const variant = buildVariant(row);
    const variants = variant ? [variant] : [];

    const sizes = Array.from(new Set(variants.map((v) => v.size)));
    const colors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean) as string[]));
    const minPrice = variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0;

    const base = {
      wcId: pick(row, ["ID", "id"]) || generateSlug(name),
      name,
      slug: generateSlug(name),
      shortDescription,
      description,
      images,
      category: mapCategory(categories),
      tags: parseTags(row),
      variants,
      minPrice,
      sizes,
      colors,
    };

    const { isImportable, skipReason } = assessImportable(base);
    products.push({ ...base, isImportable, skipReason });
  }

  return products;
}
