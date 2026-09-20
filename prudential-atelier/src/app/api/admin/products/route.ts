import { NextRequest, NextResponse } from "next/server";
import { ActivityAction, Prisma, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { productAdminSchema } from "@/validations/product";
import { logActivity, logServerError } from "@/lib/logger";
import { assertShopCategoryExists, ShopCategoryError } from "@/lib/shop-categories";
import { loadTakenSkus, resolvePreferredSku, uniqueSkuFromTaken } from "@/lib/product-sku";
import { allocateProductSlug } from "@/lib/product-slug-unique";
import { revalidateProduct } from "@/lib/revalidate";
import { derivedCatalogMinNGN } from "@/lib/pricing";
import { syncProductOptionGroup } from "@/lib/sync-product-option-group";
import {
  formatPublishedAtForLog,
  publishedAtChanged,
  resolveProductPublishedAt,
} from "@/lib/product-published-at";

const PAGE_SIZE_DEFAULT = 20;

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const take = Math.min(50, Math.max(10, Number(searchParams.get("perPage") ?? String(PAGE_SIZE_DEFAULT)) || PAGE_SIZE_DEFAULT));
  const search = (searchParams.get("search") ?? "").trim();
  const category = searchParams.get("category");
  const type = searchParams.get("type") as ProductType | null;
  const published = searchParams.get("published");
  const needsPrice = searchParams.get("needsPrice");
  const sort = searchParams.get("sort") ?? "newest";

  const where: Prisma.ProductWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category) {
    where.category = category;
  }
  if (type && Object.values(ProductType).includes(type)) {
    where.type = type;
  }
  if (published === "true") where.isPublished = true;
  if (published === "false") where.isPublished = false;
  if (needsPrice === "true") {
    where.isPublished = false;
    where.basePriceNGN = 0;
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === "name"
      ? { name: "asc" }
      : sort === "price"
        ? { priceNGN: "desc" }
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
        variants: {
          select: { id: true, priceNGN: true, salePriceNGN: true },
          orderBy: { sortOrder: "asc" },
        },
        optionGroup: { select: { options: { select: { priceAdjustmentNGN: true } } } },
        _count: { select: { orderItems: true } },
      },
    }),
  ]);

  const items = rows.map((p) => {
    const minPrice = derivedCatalogMinNGN(p.variants, p.isOnSale, p.optionGroup?.options);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      type: p.type,
      isPublished: p.isPublished,
      isFeatured: p.isFeatured,
      isNewArrival: p.isNewArrival,
      basePriceNGN: p.basePriceNGN,
      defaultVariantId: p.variants[0]?.id ?? null,
      primaryImage: p.images[0]?.url ?? null,
      variantCount: p.variants.length,
      minPriceNGN: minPrice,
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
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = productAdminSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    return NextResponse.json(
      { error: `${where}${issue?.message ?? "Invalid request"}` },
      { status: 400 },
    );
  }

  const data = parsed.data;
  try {
    await assertShopCategoryExists(data.category);
  } catch (error) {
    if (error instanceof ShopCategoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const slug = await allocateProductSlug(prisma, { name: data.name, requested: data.slug });
  const minPrice = derivedCatalogMinNGN(data.variants, data.isOnSale, data.optionGroup?.options);
  const published = resolveProductPublishedAt({
    nextPublished: data.isPublished,
    requested: data.publishedAt,
    existing: null,
  });
  if (!published.ok) {
    return NextResponse.json({ error: published.error }, { status: 400 });
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
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
          publishedAt: published.publishedAt,
          isFeatured: data.isFeatured,
          isNewArrival: data.isNewArrival,
          isBespokeAvail: data.isBespokeAvail,
          customOffered: data.customOffered ?? false,
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

      const taken = await loadTakenSkus(tx);
      for (let i = 0; i < data.variants.length; i++) {
        const v = data.variants[i];
        const preferred = resolvePreferredSku({
          name: data.name,
          size: v.size,
          submittedSku: v.sku,
          skuManual: v.skuManual,
          existing: null,
          oldName: data.name,
          nameChanged: false,
        });
        const sku = uniqueSkuFromTaken(preferred.sku, taken);
        await tx.productVariant.create({
          data: {
            productId: p.id,
            sku,
            skuManual: preferred.skuManual,
            size: v.size,
            priceNGN: v.priceNGN,
            priceUSD: v.priceUSD ?? null,
            priceGBP: v.priceGBP ?? null,
            salePriceNGN: v.salePriceNGN ?? null,
            sortOrder: v.sortOrder ?? i,
            weightKg: v.weightKg ?? null,
            lengthCm: v.lengthCm ?? null,
            widthCm: v.widthCm ?? null,
            heightCm: v.heightCm ?? null,
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

      await tx.productMeasurement.deleteMany({ where: { productId: p.id } });
      for (let i = 0; i < (data.measurementFieldIds ?? []).length; i++) {
        const mf = data.measurementFieldIds![i];
        await tx.productMeasurement.create({
          data: {
            productId: p.id,
            fieldId: mf.fieldId,
            required: mf.required,
            sortOrder: mf.sortOrder ?? i,
          },
        });
      }

      await syncProductOptionGroup(tx, p.id, data.optionGroup);

      return p;
    });

    await revalidateProduct(product.slug);

    if (publishedAtChanged(null, published.publishedAt)) {
      await logActivity({
        userId: gate.session.user.id!,
        userEmail: gate.session.user.email ?? undefined,
        userRole: gate.session.user.role,
        action: ActivityAction.CREATE,
        module: "shop.products",
        description: `Set publish date on "${product.name}" to ${formatPublishedAtForLog(published.publishedAt)}`,
        recordId: product.id,
        recordType: "Product",
        snapshot: { publishedAt: published.publishedAt?.toISOString() ?? null },
      });
    }

    return NextResponse.json({ id: product.id, slug });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "That stock code is already in use" }, { status: 409 });
    }
    await logServerError({ errorType: "ADMIN_PRODUCT_CREATE", error: e });
    return NextResponse.json({ error: "Could not create product" }, { status: 500 });
  }
}
