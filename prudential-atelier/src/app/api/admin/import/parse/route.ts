import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { parseWooCommerceCSV, type ParsedProduct } from "@/lib/woocommerce-parser";

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
  let products: ParsedProduct[];

  try {
    products = parseWooCommerceCSV(text);
  } catch {
    return NextResponse.json({ error: "Invalid CSV format" }, { status: 400 });
  }

  const slugs = products.map((p) => p.slug);
  const existing = await prisma.product.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true },
  });
  const existingSet = new Set(existing.map((e) => e.slug));

  const enriched = products.map((p) => ({
    ...p,
    isDuplicate: existingSet.has(p.slug),
  }));

  const importable = enriched.filter((p) => p.isImportable && !p.isDuplicate).length;
  const skipped = enriched.filter((p) => !p.isImportable).length;

  return NextResponse.json({
    total: enriched.length,
    importable,
    skipped,
    products: enriched,
  });
}
