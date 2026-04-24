import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { productAdminSchema, productToggleSchema } from "@/validations/product";
import { buildDefaultProductSku } from "@/lib/product-sku";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
      colors: true,
      bundleItems: {
        orderBy: { sortOrder: "asc" },
        include: { targetProduct: { select: { id: true, name: true } } },
      },
    },
  });

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body && typeof body === "object" && !("variants" in body)) {
    const toggle = productToggleSchema.safeParse(body);
    if (
      toggle.success &&
      (toggle.data.isPublished !== undefined ||
        toggle.data.isFeatured !== undefined ||
        toggle.data.isNewArrival !== undefined)
    ) {
      const updated = await prisma.product.update({
        where: { id },
        data: {
          ...(toggle.data.isPublished !== undefined ? { isPublished: toggle.data.isPublished } : {}),
          ...(toggle.data.isFeatured !== undefined ? { isFeatured: toggle.data.isFeatured } : {}),
          ...(toggle.data.isNewArrival !== undefined ? { isNewArrival: toggle.data.isNewArrival } : {}),
        },
        select: { id: true, isPublished: true, isFeatured: true, isNewArrival: true },
      });
      return NextResponse.json(updated);
    }
  }

  const parsed = productAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const slugConflict = await prisma.product.findFirst({
    where: { slug: data.slug, NOT: { id } },
    select: { id: true },
  });
  if (slugConflict) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const prices = data.variants.map((v) => v.salePriceNGN ?? v.priceNGN);
  const minPrice = Math.min(...prices);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
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

      const keepVariantIds = data.variants.map((v) => v.id).filter((x): x is string => Boolean(x));
      const orphans = await tx.productVariant.findMany({
        where:
          keepVariantIds.length > 0
            ? { productId: id, id: { notIn: keepVariantIds } }
            : { productId: id },
        select: { id: true },
      });
      for (const o of orphans) {
        const used = await tx.orderItem.count({ where: { variantId: o.id } });
        if (used > 0) {
          throw new Error("VARIANT_IN_USE");
        }
        await tx.productVariant.delete({ where: { id: o.id } });
      }

      for (let i = 0; i < data.variants.length; i++) {
        const v = data.variants[i];
        const sku = v.sku.trim() || buildDefaultProductSku(data.slug, v.size);
        if (v.id) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
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
        } else {
          await tx.productVariant.create({
            data: {
              productId: id,
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
      }

      await tx.productColor.deleteMany({ where: { productId: id } });
      for (const c of data.colors) {
        await tx.productColor.create({
          data: {
            productId: id,
            name: c.name,
            hex: c.hex,
            imageUrl: c.imageUrl ?? null,
          },
        });
      }

      await tx.productImage.deleteMany({ where: { productId: id } });
      for (let i = 0; i < data.images.length; i++) {
        const im = data.images[i];
        await tx.productImage.create({
          data: {
            productId: id,
            url: im.url,
            alt: im.alt ?? null,
            isPrimary: im.isPrimary,
            sortOrder: im.sortOrder ?? i,
          },
        });
      }

      await tx.bundleItem.deleteMany({ where: { sourceProductId: id } });
      let sortOrder = 0;
      for (const targetId of data.bundleProductIds) {
        if (targetId === id) continue;
        const exists = await tx.product.findUnique({ where: { id: targetId }, select: { id: true } });
        if (!exists) continue;
        await tx.bundleItem.create({
          data: { sourceProductId: id, targetProductId: targetId, sortOrder: sortOrder++ },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "VARIANT_IN_USE") {
      return NextResponse.json(
        { error: "Cannot remove a variant that appears on past orders" },
        { status: 409 },
      );
    }
    console.error("[admin/products PATCH]", e);
    return NextResponse.json({ error: "Could not update product" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const blocking = await prisma.orderItem.count({
    where: {
      productId: id,
      order: { status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] } },
    },
  });
  if (blocking > 0) {
    return NextResponse.json(
      { error: "Cannot delete — active orders contain this product" },
      { status: 409 },
    );
  }

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
