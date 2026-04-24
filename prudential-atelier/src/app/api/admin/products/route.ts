import { NextRequest, NextResponse } from "next/server";
import { Prisma, ProductCategory, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { productAdminSchema } from "@/validations/product";
import { buildDefaultProductSku } from "@/lib/product-sku";

const PAGE_SIZE_DEFAULT = 20;

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const take = Math.min(50, Math.max(10, Number(searchParams.get("perPage") ?? String(PAGE_SIZE_DEFAULT)) || PAGE_SIZE_DEFAULT));
  const search = (searchParams.get("search") ?? "").trim();
  const category = searchParams.get("category") as ProductCategory | null;
  const type = searchParams.get("type") as ProductType | null;
  const published = searchParams.get("published");
  const stock = searchParams.get("stock");
  const sort = searchParams.get("sort") ?? "newest";

  const where: Prisma.ProductWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category && Object.values(ProductCategory).includes(category)) {
    where.category = category;
  }
  if (type && Object.values(ProductType).includes(type)) {
    where.type = type;
  }
  if (published === "true") where.isPublished = true;
  if (published === "false") where.isPublished = false;

  if (stock === "out") {
    where.variants = { some: { stock: 0 } };
  } else if (stock === "in") {
    where.NOT = { variants: { some: { stock: 0 } } };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === "name"
      ? { name: "asc" }
      : sort === "price"
        ? { basePriceNGN: "desc" }
        : { createdAt: "desc" };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * take,
      take,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: { select: { priceNGN: true, salePriceNGN: true, stock: true } },
        _count: { select: { orderItems: true } },
      },
    }),
  ]);

  const items = rows.map((p) => {
    const prices = p.variants.map((v) => v.salePriceNGN ?? v.priceNGN);
    const minPrice = prices.length ? Math.min(...prices) : p.basePriceNGN;
    const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      type: p.type,
      isPublished: p.isPublished,
      isFeatured: p.isFeatured,
      primaryImage: p.images[0]?.url ?? null,
      variantCount: p.variants.length,
      minPriceNGN: minPrice,
      totalStock,
      orderItemsCount: p._count.orderItems,
    };
  });

  return NextResponse.json({
    items,
    total,
    page,
    perPage: take,
    totalPages: Math.max(1, Math.ceil(total / take)),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = productAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const slugTaken = await prisma.product.findUnique({ where: { slug: data.slug }, select: { id: true } });
  if (slugTaken) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const prices = data.variants.map((v) => v.salePriceNGN ?? v.priceNGN);
  const minPrice = Math.min(...prices);

  try {
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description ?? "",
          details: data.details ?? null,
          metaTitle: data.metaTitle ?? null,
          metaDescription: data.metaDescription ?? null,
          category: data.category,
          type: data.type,
          tags: data.tags,
          basePriceNGN: data.basePriceNGN,
          priceNGN: minPrice,
          priceUSD: data.basePriceUSD ?? null,
          priceGBP: data.basePriceGBP ?? null,
          isOnSale: data.isOnSale,
          saleEndsAt: data.saleEndsAt ?? null,
          isPublished: data.isPublished,
          isFeatured: data.isFeatured,
          isNewArrival: data.isNewArrival,
          isBespokeAvail: data.isBespokeAvail,
          inStock: data.variants.some((v) => v.stock > 0),
        },
      });

      for (let i = 0; i < data.variants.length; i++) {
        const v = data.variants[i];
        const sku = v.sku.trim() || buildDefaultProductSku(data.slug, v.size);
        await tx.productVariant.create({
          data: {
            productId: p.id,
            sku,
            size: v.size,
            priceNGN: v.priceNGN,
            priceUSD: v.priceUSD ?? null,
            priceGBP: v.priceGBP ?? null,
            salePriceNGN: v.salePriceNGN ?? null,
            stock: v.stock,
            lowStockAt: v.lowStockAt,
            sortOrder: v.sortOrder ?? i,
          },
        });
      }

      for (const c of data.colors) {
        await tx.productColor.create({
          data: {
            productId: p.id,
            name: c.name,
            hex: c.hex,
            imageUrl: c.imageUrl ?? null,
          },
        });
      }

      for (let i = 0; i < data.images.length; i++) {
        const im = data.images[i];
        await tx.productImage.create({
          data: {
            productId: p.id,
            url: im.url,
            alt: im.alt ?? null,
            isPrimary: im.isPrimary,
            sortOrder: im.sortOrder ?? i,
          },
        });
      }

      let sortOrder = 0;
      for (const targetId of data.bundleProductIds) {
        if (targetId === p.id) continue;
        const exists = await tx.product.findUnique({ where: { id: targetId }, select: { id: true } });
        if (!exists) continue;
        await tx.bundleItem.create({
          data: {
            sourceProductId: p.id,
            targetProductId: targetId,
            sortOrder: sortOrder++,
          },
        });
      }

      return p;
    });

    return NextResponse.json({ id: product.id, slug: product.slug });
  } catch (e) {
    console.error("[admin/products POST]", e);
    return NextResponse.json({ error: "Could not create product" }, { status: 500 });
  }
}
