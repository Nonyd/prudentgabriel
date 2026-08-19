import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/logger";
import { revalidateAfterBulkImport } from "@/lib/revalidate";
import { slugifyText } from "@/lib/utils";
import type { ParsedProduct } from "@/lib/woocommerce-parser";

type ImportBody = {
  products: ParsedProduct[];
};

function colorToHex(name: string): string {
  const map: Record<string, string> = {
    black: "#000000",
    white: "#FFFFFF",
    red: "#C41E3A",
    blue: "#1E3A8A",
    green: "#166534",
    pink: "#F9A8D4",
    gold: "#D4AF37",
    silver: "#C0C0C0",
    beige: "#F5F5DC",
    cream: "#FFFDD0",
    brown: "#5C3422",
    navy: "#1B2A4A",
    purple: "#6B21A8",
  };
  const key = name.toLowerCase().trim();
  return map[key] ?? "#888888";
}

async function importParsedProduct(product: ParsedProduct): Promise<{ id: string } | { error: string }> {
  const baseSlug = slugifyText(product.slug || product.name);
  let suffix = 0;
  let finalSlug = baseSlug;

  while (true) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix}`;
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) {
      finalSlug = candidate;
      break;
    }
    suffix += 1;
  }

  const colorNames = Array.from(
    new Set(product.variants.map((v) => v.color).filter(Boolean) as string[]),
  );

  const created = await prisma.product.create({
    data: {
      name: product.name,
      slug: finalSlug,
      description: product.description || product.shortDescription || "",
      details: product.shortDescription || "",
      category: product.category,
      type: "RTW",
      tags: product.tags,
      basePriceNGN: product.minPrice,
      priceNGN: product.minPrice,
      isPublished: false,
      isFeatured: false,
      isNewArrival: false,
      isBespokeAvail: false,
      inStock: true,
      images: {
        create: product.images.map((url, idx) => ({
          url,
          alt: product.name,
          isPrimary: idx === 0,
          sortOrder: idx,
        })),
      },
      variants: {
        create: product.variants.map((v, idx) => ({
          size: v.size,
          sku: v.sku || `PG-${finalSlug.toUpperCase().slice(0, 6)}-${idx + 1}`,
          priceNGN: v.price,
          stock: 0,
          lowStockAt: 3,
          sortOrder: idx,
        })),
      },
      colors:
        colorNames.length > 0
          ? {
              create: colorNames.map((name) => ({
                name,
                hex: colorToHex(name),
              })),
            }
          : undefined,
    },
  });

  return { id: created.id };
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;

  let body: ImportBody;
  try {
    body = (await req.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const toImport = (body.products ?? []).filter((p) => p.isImportable);

  let imported = 0;
  let failed = 0;
  const errors: string[] = [];
  const productIds: string[] = [];

  for (const product of toImport) {
    try {
      const result = await importParsedProduct(product);
      if ("error" in result) {
        failed += 1;
        errors.push(`${product.name}: ${result.error}`);
      } else {
        imported += 1;
        productIds.push(result.id);
      }
    } catch (e) {
      failed += 1;
      errors.push(`${product.name}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  if (imported > 0) {
    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role,
      action: "CREATE",
      module: "import",
      description: `Imported ${imported} products from WooCommerce CSV`,
    });
    await revalidateAfterBulkImport();
  }

  return NextResponse.json({ imported, failed, errors, productIds });
}
