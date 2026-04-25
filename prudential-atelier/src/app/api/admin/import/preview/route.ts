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

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
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

  const previewProducts = parsedRows
    .map((row, index) => {
      const name = pick(row, ["Name", "name", "post_title"]).trim();
      if (!name) return null;
      const slug = slugifyText(name);
      if (!slug) return null;
      const imageRaw = pick(row, ["Images", "images", "image"]);
      const imageUrls = imageRaw
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
        .slice(0, 5);
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
    warning: truncated ? "CSV exceeds 500 rows. Only first 500 shown." : undefined,
    products,
  });
}
