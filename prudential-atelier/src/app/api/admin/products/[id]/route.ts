import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { productAdminSchema, productToggleSchema } from "@/validations/product";
import { buildDefaultProductSku } from "@/lib/product-sku";
import { revalidateProduct } from "@/lib/revalidate";
import { canInlineEditPrice, derivedCatalogMinNGN } from "@/lib/pricing";
import { processRestockAlerts } from "@/lib/stock-alerts";
import { destroyCloudinaryAsset } from "@/lib/cloudinary-public-id";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
      colors: true,
      measurementFields: { include: { field: true }, orderBy: { sortOrder: "asc" } },
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
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body && typeof body === "object" && !("variants" in body)) {
    if ("basePriceNGN" in body) {
      const payload = body as { basePriceNGN?: unknown; variantId?: unknown };
      const basePrice = Number(payload.basePriceNGN);
      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        return NextResponse.json({ error: "basePriceNGN must be a positive number" }, { status: 400 });
      }
      const variantCount = await prisma.productVariant.count({ where: { productId: id } });
      const inline = canInlineEditPrice(variantCount);
      if (!inline.ok) {
        return NextResponse.json({ error: inline.error }, { status: 409 });
      }
      const variantId = typeof payload.variantId === "string" ? payload.variantId : undefined;
      const updated = await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id },
          data: { basePriceNGN: basePrice, priceNGN: basePrice },
          select: { id: true },
        });
        const existingVariant = variantId
          ? await tx.productVariant.findFirst({
              where: { id: variantId, productId: id },
              select: { id: true },
            })
          : null;
        if (existingVariant) {
          await tx.productVariant.update({
            where: { id: existingVariant.id },
            data: { priceNGN: basePrice },
          });
        } else {
          const fallback = await tx.productVariant.findFirst({
            where: { productId: id },
            orderBy: { sortOrder: "asc" },
            select: { id: true },
          });
          if (fallback) {
            await tx.productVariant.update({
              where: { id: fallback.id },
              data: { priceNGN: basePrice },
            });
          }
        }
        return { id, basePriceNGN: basePrice };
      });
      const slugRow = await prisma.product.findUnique({ where: { id }, select: { slug: true } });
      if (slugRow) await revalidateProduct(slugRow.slug);
      return NextResponse.json(updated);
    }

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
        select: { id: true, slug: true, isPublished: true, isFeatured: true, isNewArrival: true },
      });
      await revalidateProduct(updated.slug);
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

  const minPrice = derivedCatalogMinNGN(data.variants, data.isOnSale);

  const oldVariants = await prisma.productVariant.findMany({
    where: { productId: id },
    select: { id: true, stock: true },
  });
  const oldStockMap = new Map(oldVariants.map((v) => [v.id, v.stock]));

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
          basePriceNGN: minPrice,
          priceNGN: minPrice,
          priceUSD: data.basePriceUSD ?? null,
          priceGBP: data.basePriceGBP ?? null,
          isOnSale: data.isOnSale,
          saleEndsAt: data.saleEndsAt ?? null,
          isPublished: data.isPublished,
          isFeatured: data.isFeatured,
          isNewArrival: data.isNewArrival,
          isBespokeAvail: data.isBespokeAvail,
          customOffered: data.customOffered ?? false,
          customSurchargeKind: data.customSurchargeKind ?? null,
          customSurchargeValue: data.customSurchargeValue ?? null,
          customLeadTimeDays: data.customLeadTimeDays ?? null,
          customReturnable: data.customReturnable ?? null,
          inStock: data.variants.some((v) => v.stock > 0),
          defaultWeightKg: data.defaultWeightKg ?? null,
          defaultLengthCm: data.defaultLengthCm ?? null,
          defaultWidthCm: data.defaultWidthCm ?? null,
          defaultHeightCm: data.defaultHeightCm ?? null,
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
              weightKg: v.weightKg ?? null,
              lengthCm: v.lengthCm ?? null,
              widthCm: v.widthCm ?? null,
              heightCm: v.heightCm ?? null,
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
              weightKg: v.weightKg ?? null,
              lengthCm: v.lengthCm ?? null,
              widthCm: v.widthCm ?? null,
              heightCm: v.heightCm ?? null,
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

      await tx.productMeasurement.deleteMany({ where: { productId: id } });
      for (let i = 0; i < (data.measurementFieldIds ?? []).length; i++) {
        const mf = data.measurementFieldIds![i];
        await tx.productMeasurement.create({
          data: {
            productId: id,
            fieldId: mf.fieldId,
            required: mf.required,
            sortOrder: mf.sortOrder ?? i,
          },
        });
      }
    });

    await revalidateProduct(data.slug);

    const restockedIds = data.variants
      .filter((v) => v.id && (oldStockMap.get(v.id) ?? 0) <= 0 && v.stock > 0)
      .map((v) => v.id as string);
    if (restockedIds.length) {
      void processRestockAlerts(restockedIds);
    }

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
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      slug: true,
      images: { select: { url: true } },
      _count: { select: { orderItems: true } },
    },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const activeOrders = await prisma.orderItem.count({
    where: {
      productId: id,
      order: { status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] } },
    },
  });
  if (activeOrders > 0) {
    return NextResponse.json(
      { error: "Cannot delete — active orders contain this product" },
      { status: 409 },
    );
  }

  if (product._count.orderItems > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete — this product appears in ${product._count.orderItems} past order(s). Unpublish it instead.`,
      },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { productId: id } }),
      prisma.wishlistItem.deleteMany({ where: { productId: id } }),
      prisma.review.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);

    await Promise.all(product.images.map((im) => destroyCloudinaryAsset(im.url)));
    await revalidateProduct(product.slug);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2003") {
        return NextResponse.json(
          { error: "Cannot delete — this product is still linked to other records (orders, carts, or reviews)." },
          { status: 409 },
        );
      }
      if (e.code === "P2025") {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
    }
    console.error("[admin/products DELETE]", e);
    return NextResponse.json({ error: "Could not delete product" }, { status: 500 });
  }
}
