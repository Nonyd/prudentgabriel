import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, requireSuperAdminApi } from "@/lib/admin-auth";
import { productAdminSchema, productToggleSchema } from "@/validations/product";
import { loadTakenSkus, resolvePreferredSku, uniqueSkuFromTaken } from "@/lib/product-sku";
import { allocateProductSlug } from "@/lib/product-slug-unique";
import { missingPublishNeeds, joinNeedLabels } from "@/lib/product-wizard";
import { revalidateProduct } from "@/lib/revalidate";
import { canInlineEditPrice, derivedCatalogMinNGN } from "@/lib/pricing";
import { processRestockAlerts } from "@/lib/stock-alerts";
import { destroyStoredMedia } from "@/lib/media/destroy";
import { executeProductCascade, previewProductCascade, ProductCascadeError } from "@/lib/product-cascade-delete";
import { applyCountCorrection, applyOpening, afterStockWrites, syncProductInStock, type StockWriteResult } from "@/lib/stock-ledger";

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
      if (toggle.data.isPublished === true) {
        const current = await prisma.product.findUnique({
          where: { id },
          include: { images: { select: { url: true } }, variants: { select: { size: true, priceNGN: true } } },
        });
        if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const missing = missingPublishNeeds(current);
        if (missing.length) {
          return NextResponse.json(
            {
              error: `To publish this piece it still needs ${joinNeedLabels(missing.map((m) => m.label))}.`,
            },
            { status: 400 },
          );
        }
      }
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
  const slug = data.slug?.trim()
    ? data.slug.trim()
    : await allocateProductSlug(prisma, { name: data.name, excludeId: id });
  if (data.slug?.trim()) {
    const slugConflict = await prisma.product.findFirst({
      where: { slug, NOT: { id } },
      select: { id: true },
    });
    if (slugConflict) {
      return NextResponse.json({ error: "That web address is already in use" }, { status: 409 });
    }
  }

  const minPrice = derivedCatalogMinNGN(data.variants, data.isOnSale);

  const oldVariants = await prisma.productVariant.findMany({
    where: { productId: id },
    select: { id: true, stock: true, sku: true, skuManual: true, size: true },
  });
  const oldStockMap = new Map(oldVariants.map((v) => [v.id, v.stock]));
  const oldVariantMap = new Map(oldVariants.map((v) => [v.id, v]));
  const oldName = (await prisma.product.findUnique({ where: { id }, select: { name: true } }))?.name ?? data.name;

  const actorId = gate.session.user.id!;
  const stockWrites: StockWriteResult[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: data.name,
          slug,
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
          customOfferedWhenSoldOut: data.customOfferedWhenSoldOut ?? false,
          customSurchargeKind: data.customSurchargeKind ?? null,
          customSurchargeValue: data.customSurchargeValue ?? null,
          customLeadTimeDays: data.customLeadTimeDays ?? null,
          customReturnable: data.customReturnable ?? null,
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

      const taken = await loadTakenSkus(tx, keepVariantIds);
      for (let i = 0; i < data.variants.length; i++) {
        const v = data.variants[i];
        const existing = v.id ? oldVariantMap.get(v.id) : undefined;
        const preferred = resolvePreferredSku({
          name: data.name,
          size: v.size,
          submittedSku: v.sku,
          skuManual: v.skuManual,
          existing: existing
            ? { sku: existing.sku, skuManual: existing.skuManual, size: existing.size }
            : null,
          oldName,
          nameChanged: oldName !== data.name,
          regenerate: Boolean(data.regenerateSkus) && !v.skuManual && !existing?.skuManual,
        });
        const sku = uniqueSkuFromTaken(preferred.sku, taken);
        if (v.id) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              sku,
              skuManual: preferred.skuManual,
              size: v.size,
              priceNGN: v.priceNGN,
              priceUSD: v.priceUSD ?? null,
              priceGBP: v.priceGBP ?? null,
              salePriceNGN: v.salePriceNGN ?? null,
              lowStockAt: v.lowStockAt,
              sortOrder: v.sortOrder ?? i,
              weightKg: v.weightKg ?? null,
              lengthCm: v.lengthCm ?? null,
              widthCm: v.widthCm ?? null,
              heightCm: v.heightCm ?? null,
            },
          });
          const write = await applyCountCorrection(tx, {
            variantId: v.id,
            newStock: v.stock,
            actorId,
          });
          if (write) stockWrites.push(write);
        } else {
          const created = await tx.productVariant.create({
            data: {
              productId: id,
              sku,
              skuManual: preferred.skuManual,
              size: v.size,
              priceNGN: v.priceNGN,
              priceUSD: v.priceUSD ?? null,
              priceGBP: v.priceGBP ?? null,
              salePriceNGN: v.salePriceNGN ?? null,
              stock: 0,
              lowStockAt: v.lowStockAt,
              sortOrder: v.sortOrder ?? i,
              weightKg: v.weightKg ?? null,
              lengthCm: v.lengthCm ?? null,
              widthCm: v.widthCm ?? null,
              heightCm: v.heightCm ?? null,
            },
          });
          const write = await applyOpening(tx, { variantId: created.id, stock: v.stock });
          if (write) stockWrites.push(write);
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

      await syncProductInStock(tx, id);
    });

    await revalidateProduct(slug);
    if (stockWrites.length) await afterStockWrites(stockWrites);

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
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "That stock code is already in use" }, { status: 409 });
    }
    console.error("[admin/products PATCH]", e);
    return NextResponse.json({ error: "Could not update product" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let confirmation: string | undefined;
  try {
    const json = (await req.json()) as { confirmation?: unknown };
    if (typeof json.confirmation === "string") confirmation = json.confirmation;
  } catch {
    confirmation = undefined;
  }

  try {
    const preview = await previewProductCascade([id]);
    if (preview.loud) {
      const superGate = await requireSuperAdminApi();
      if (!superGate.ok) return superGate.response;
    }

    const result = await executeProductCascade({
      productIds: [id],
      confirmation,
      actor: {
        userId: gate.session.user.id!,
        email: gate.session.user.email ?? null,
        role: gate.session.user.role ?? "",
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null,
      },
    });

    await Promise.all(
      result.mediaUrls.map((url) => destroyStoredMedia(url).catch((err) => console.error("[product-cascade media]", url, err))),
    );
    await Promise.all(result.slugs.map((slug) => revalidateProduct(slug).catch(() => undefined)));
    return NextResponse.json({ ok: true, logId: result.logId, deleted: result.deletedProductIds.length });
  } catch (e) {
    if (e instanceof ProductCascadeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/products DELETE]", e);
    return NextResponse.json({ error: "Delete failed; nothing was removed" }, { status: 500 });
  }
}
