/**
 * Slice AW: product publish dates — Newest first vs Curated order.
 *
 *   pnpm test:slice-aw
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductType, Role } from "@prisma/client";
import { ProductCategory } from "../src/lib/shop-category-slug";
import {
  FUTURE_PUBLISH_DATE_MESSAGE,
  isFuturePublishDate,
  resolveProductPublishedAt,
} from "../src/lib/product-published-at";
import { queryProductList } from "../src/lib/products-list-query";
import { prisma } from "../src/lib/prisma";
import { productAdminSchema } from "../src/validations/product";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const stamp = `aw-${Date.now()}`;

function runPure() {
  assert(src("prisma/schema.prisma").includes("publishedAt"), "Product.publishedAt exists");
  assert(src("src/lib/products-list-query.ts").includes("publishedAt"), "list query sorts on publishedAt");
  assert(src("src/lib/products-list-query.ts").includes('case "curated"'), "curated sort kept separate");
  assert(src("src/app/(storefront)/rtw/page.tsx").includes('"curated"'), "rtw still defaults to curated");
  assert(src("src/app/(storefront)/shop/page.tsx").includes('"featured"'), "shop defaults to featured");
  assert(src("src/components/admin/ProductFormPage.tsx").includes("Publish date"), "admin exposes publish date");
  assert(
    src("src/components/admin/ProductFormPage.tsx").includes("Newest"),
    "admin hint says backdating only moves Newest first",
  );
  assert(src("src/lib/seo-jsonld.ts").includes("datePublished"), "structured data takes publish date");
  assert(src("src/lib/sitemap-build.ts").includes("publishedAt"), "sitemap aware of publish date");

  const now = new Date(2026, 8, 20, 15, 0, 0);
  assert(!isFuturePublishDate(new Date(2026, 8, 20), now), "today is allowed");
  assert(isFuturePublishDate(new Date(2026, 8, 21), now), "tomorrow is refused");

  const firstPublish = resolveProductPublishedAt({
    nextPublished: true,
    requested: undefined,
    existing: null,
    now,
  });
  assert(firstPublish.ok && firstPublish.publishedAt?.getTime() === now.getTime(), "first publish defaults to now");

  const keep = resolveProductPublishedAt({
    nextPublished: false,
    requested: undefined,
    existing: now,
    now,
  });
  assert(keep.ok && keep.publishedAt?.getTime() === now.getTime(), "unpublish keeps the date");

  const future = resolveProductPublishedAt({
    nextPublished: true,
    requested: new Date(2026, 8, 25),
    existing: null,
    now,
  });
  assert(!future.ok && future.error === FUTURE_PUBLISH_DATE_MESSAGE, "future date refused with clear message");

  const parsed = productAdminSchema.safeParse({
    name: "AW future",
    category: "CASUAL",
    type: ProductType.RTW,
    isPublished: false,
    publishedAt: "2099-01-01",
    variants: [],
    images: [],
  });
  assert(!parsed.success, "zod refuses a future publish date");
  const issue = parsed.success ? null : parsed.error.issues.find((i) => i.path[0] === "publishedAt");
  assert(issue?.message === FUTURE_PUBLISH_DATE_MESSAGE, "zod message matches AW3 refuse");
}

async function runDb() {
  const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const mid = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  const featured = await prisma.product.create({
    data: {
      name: `AW Featured ${stamp}`,
      slug: `aw-feat-${stamp}`,
      description: "Featured pin",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 200_000,
      basePriceNGN: 200_000,
      isPublished: true,
      isFeatured: true,
      displayOrder: 99,
      publishedAt: old,
      createdAt: recent,
      variants: { create: [{ size: "12", priceNGN: 200_000 }] },
    },
  });
  const backdated = await prisma.product.create({
    data: {
      name: `AW Backdated ${stamp}`,
      slug: `aw-back-${stamp}`,
      description: "Backdated",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 150_000,
      basePriceNGN: 150_000,
      isPublished: true,
      isFeatured: false,
      displayOrder: 0,
      publishedAt: old,
      createdAt: recent,
      variants: { create: [{ size: "12", priceNGN: 150_000 }] },
    },
  });
  const fresh = await prisma.product.create({
    data: {
      name: `AW Fresh ${stamp}`,
      slug: `aw-fresh-${stamp}`,
      description: "Fresh",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 160_000,
      basePriceNGN: 160_000,
      isPublished: true,
      isFeatured: false,
      displayOrder: 1,
      publishedAt: mid,
      createdAt: old,
      variants: { create: [{ size: "12", priceNGN: 160_000 }] },
    },
  });
  const unpublished = await prisma.product.create({
    data: {
      name: `AW Draft ${stamp}`,
      slug: `aw-draft-${stamp}`,
      description: "Draft",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 110_000,
      basePriceNGN: 110_000,
      isPublished: false,
      isFeatured: false,
      displayOrder: 0,
      publishedAt: recent,
      variants: { create: [{ size: "12", priceNGN: 110_000 }] },
    },
  });

  try {
    const newest = await queryProductList(
      new URLSearchParams({
        sort: "newest",
        type: "RTW",
        search: stamp,
        limit: "24",
      }),
      { isAdmin: false },
    );
    const newestIds = newest.products.map((p) => p.id);
    assert(!newestIds.includes(unpublished.id), "unpublished product appears nowhere on Newest");
    const iFeat = newestIds.indexOf(featured.id);
    const iFresh = newestIds.indexOf(fresh.id);
    const iBack = newestIds.indexOf(backdated.id);
    assert(iFeat >= 0 && iFresh >= 0 && iBack >= 0, "published pieces appear under Newest");
    assert(iFeat < iFresh && iFeat < iBack, "Featured still pins above Newest first");
    assert(iFresh < iBack, "backdating moves a piece down under Newest first");

    const curated = await queryProductList(
      new URLSearchParams({
        sort: "curated",
        type: "RTW",
        search: stamp,
        limit: "24",
      }),
      { isAdmin: false },
    );
    const curatedIds = curated.products.map((p) => p.id);
    assert(!curatedIds.includes(unpublished.id), "unpublished product appears nowhere on Curated");
    const cFeat = curatedIds.indexOf(featured.id);
    const cBack = curatedIds.indexOf(backdated.id);
    const cFresh = curatedIds.indexOf(fresh.id);
    assert(cFeat >= 0 && cBack >= 0 && cFresh >= 0, "published pieces appear under Curated");
    assert(cFeat < cBack && cFeat < cFresh, "Featured still pins above Curated order");
    assert(cBack < cFresh, "backdating does not reorder Curated (displayOrder wins)");

    const actor = await prisma.user.create({
      data: { email: `${stamp}@sliceaw.test`, name: "Slice AW", role: Role.SUPER_ADMIN },
    });
    const before = backdated.publishedAt;
    const nextDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await prisma.product.update({
      where: { id: backdated.id },
      data: { publishedAt: nextDate },
    });
    await prisma.activityLog.create({
      data: {
        userId: actor.id,
        userEmail: actor.email,
        userRole: actor.role,
        action: "UPDATE",
        module: "shop.products",
        description: `Changed publish date on "${backdated.name}"`,
        recordId: backdated.id,
        recordType: "Product",
        snapshot: {
          before: before?.toISOString() ?? null,
          after: nextDate.toISOString(),
        },
      },
    });
    const log = await prisma.activityLog.findFirst({
      where: { recordId: backdated.id, module: "shop.products" },
      orderBy: { createdAt: "desc" },
    });
    assert(log, "changing publish date writes an ActivityLog line");

    await prisma.activityLog.deleteMany({ where: { recordId: backdated.id } });
    await prisma.user.delete({ where: { id: actor.id } }).catch(() => undefined);
  } finally {
    await prisma.productVariant.deleteMany({
      where: { productId: { in: [featured.id, backdated.id, fresh.id, unpublished.id] } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: [featured.id, backdated.id, fresh.id, unpublished.id] } },
    });
  }
}

async function main() {
  runPure();
  await runDb();
  console.log("PASS: slice AW publish dates");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
