import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { slugifyText } from "@/lib/utils";

type CsvRow = Record<string, string | undefined>;

type PreviewProduct = {
  rowIndex: number;
  name: string;
  slug: string;
  imageUrls: string[];
  firstImageUrl: string;
  description: string;
  shortDesc: string;
  sku: string;
  stock: number;
  isDuplicate: boolean;
};

const MAX_ROWS = 500;

function cleanText(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}

function pick(row: CsvRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}

/** WooCommerce uses comma-separated URLs in the Images column. */
function parseImageUrls(imageRaw: string): string[] {
  return imageRaw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 5);
}

/**
 * Variation rows usually have an empty Images column; gallery URLs live on the
 * parent variable product row. WooCommerce "Parent" is typically the parent's SKU
 * or post ID; some exports use the parent product title.
 */
function buildParentImageLookups(rows: CsvRow[]) {
  const byId = new Map<string, string[]>();
  const bySku = new Map<string, string[]>();
  const bySlug = new Map<string, string[]>();
  const byName = new Map<string, string[]>();

  for (const row of rows) {
    const urls = parseImageUrls(pick(row, ["Images", "images", "image"]));
    if (urls.length === 0) continue;

    const id = pick(row, ["ID", "id"]);
    const sku = pick(row, ["SKU", "sku"]);
    const name = pick(row, ["Name", "name", "post_title"]).trim();
    const slugCol = pick(row, ["Slug", "slug"]);
    const slugFromName = name ? slugifyText(name) : "";
    const slugFromCol = slugCol ? slugifyText(slugCol) : "";

    if (id) byId.set(id, urls);
    if (sku) bySku.set(sku, urls);
    if (slugFromName) bySlug.set(slugFromName, urls);
    if (slugFromCol && slugFromCol !== slugFromName) bySlug.set(slugFromCol, urls);
    if (slugCol && slugCol !== slugFromName) bySlug.set(slugCol, urls);
    if (name) byName.set(name, urls);
  }

  return { byId, bySku, bySlug, byName };
}

function resolveVariationImages(
  row: CsvRow,
  lookups: ReturnType<typeof buildParentImageLookups>,
  allRows: CsvRow[],
): string[] {
  const direct = parseImageUrls(pick(row, ["Images", "images", "image"]));
  if (direct.length > 0) return direct;

  const parentRef = pick(row, ["Parent", "parent"]);
  if (!parentRef) return [];

  const { byId, bySku, bySlug, byName } = lookups;
  const fromSku = bySku.get(parentRef);
  if (fromSku?.length) return fromSku;
  const fromId = byId.get(parentRef);
  if (fromId?.length) return fromId;
  const fromSlugRaw = bySlug.get(parentRef);
  if (fromSlugRaw?.length) return fromSlugRaw;
  const slugKey = slugifyText(parentRef);
  const fromSlug = slugKey ? bySlug.get(slugKey) : undefined;
  if (fromSlug?.length) return fromSlug;
  const fromName = byName.get(parentRef);
  if (fromName?.length) return fromName;

  const parentRow = allRows.find((r) => pick(r, ["Name", "name", "post_title"]).trim() === parentRef);
  if (parentRow) {
    const fromParentRow = parseImageUrls(pick(parentRow, ["Images", "images", "image"]));
    if (fromParentRow.length > 0) return fromParentRow;
  }

  return [];
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing CSV file" }, { status: 400 });
  }

  const text = await file.text();
  let parsedRows: CsvRow[] = [];

  try {
    const result = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });
    if (result.errors.length > 0) {
      return NextResponse.json({ error: "Invalid CSV format" }, { status: 400 });
    }
    parsedRows = result.data;
  } catch {
    return NextResponse.json({ error: "Invalid CSV format" }, { status: 400 });
  }

  const parentImageLookups = buildParentImageLookups(parsedRows);

  let skippedNoImage = 0;
  const previewProducts = parsedRows
    .map((row, index) => {
      const name = pick(row, ["Name", "name", "post_title"]).trim();
      if (!name) return null;
      const slug = slugifyText(name);
      if (!slug) return null;
      const imageUrls = resolveVariationImages(row, parentImageLookups, parsedRows);
      if (imageUrls.length === 0) {
        skippedNoImage += 1;
        return null;
      }
      const description = cleanText(pick(row, ["Description", "description"])).slice(0, 500);
      const shortDesc = cleanText(pick(row, ["Short description", "short_description"])).slice(0, 500);
      const sku = pick(row, ["SKU", "sku"]);
      const stockRaw = pick(row, ["Stock", "stock"]);
      const stockParsed = Number.parseInt(stockRaw || "0", 10);
      const previewProduct: PreviewProduct = {
        rowIndex: index,
        name,
        slug,
        imageUrls,
        firstImageUrl: imageUrls[0] ?? "",
        description,
        shortDesc,
        sku,
        stock: Number.isNaN(stockParsed) ? 0 : stockParsed,
        isDuplicate: false,
      };
      return previewProduct;
    })
    .filter((row): row is PreviewProduct => Boolean(row));

  const truncated = previewProducts.length > MAX_ROWS;
  const limitedProducts = previewProducts.slice(0, MAX_ROWS);
  const allSlugs = Array.from(new Set(limitedProducts.map((p) => p.slug)));
  const existing = await prisma.product.findMany({
    where: { slug: { in: allSlugs } },
    select: { slug: true },
  });
  const existingSet = new Set(existing.map((item) => item.slug));

  const products = limitedProducts.map((p) => ({
    ...p,
    isDuplicate: existingSet.has(p.slug),
  }));

  return NextResponse.json({
    total: products.length,
    skippedNoImage,
    warning: truncated ? "CSV exceeds 500 rows. Only first 500 shown." : undefined,
    products,
  });
}
