import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { mapProductToListItem } from "@/lib/map-product-list-item";
import { ShopBrowse } from "@/components/shop/ShopBrowse";
import { optimizeImageUrl } from "@/lib/utils";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await prisma.collection.findUnique({
    where: { slug, isPublished: true },
    select: { name: true, description: true },
  });
  if (!collection) return { title: "Collection | Prudent Gabriel" };
  return {
    title: `${collection.name} | Ready to Wear`,
    description: collection.description ?? undefined,
  };
}

export default async function RTWCollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = await prisma.collection.findUnique({
    where: { slug, isPublished: true },
    include: {
      products: {
        include: {
          product: {
            include: {
              images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
              variants: true,
              colors: true,
              _count: { select: { reviews: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!collection) notFound();

  const products = collection.products
    .filter((cp) => cp.product.isPublished)
    .map((cp) =>
      mapProductToListItem({
        ...cp.product,
        images: cp.product.images.map((im, i) => ({
          url: im.url,
          alt: im.alt,
          isPrimary: im.isPrimary ?? i === 0,
        })),
      }),
    );

  return (
    <div>
      {collection.coverImage ? (
        <div className="relative h-[min(50vh,420px)] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={optimizeImageUrl(collection.coverImage, 1600)}
            alt={collection.coverImageAlt || collection.name}
            className="h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-choc/50" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 5vw, 52px)",
                color: "var(--cream)",
              }}
            >
              {collection.name}
            </h1>
            {collection.description ? (
              <p
                className="mx-auto mt-4 max-w-xl"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "15px",
                  color: "var(--sand)",
                }}
              >
                {collection.description}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="bg-ivory px-6 py-16 text-center lg:px-10">
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "52px",
              color: "var(--choc)",
            }}
          >
            {collection.name}
          </h1>
          {collection.description ? (
            <p
              className="mx-auto mt-4 max-w-xl"
              style={{ fontFamily: "var(--font-body)", fontSize: "15px", color: "var(--text-mid)" }}
            >
              {collection.description}
            </p>
          ) : null}
        </div>
      )}

      <div className="mx-auto max-w-site px-6 pt-8 lg:px-10">
        <Link
          href="/rtw"
          className="uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            color: "var(--lightbr)",
          }}
        >
          ← Back to Ready-to-Wear
        </Link>
      </div>

      <ShopBrowse
        products={products}
        total={products.length}
        page={1}
        totalPages={1}
        hasNext={false}
        hasPrev={false}
        heroHeadline={collection.name}
        heroSubtext={collection.season ?? undefined}
        hideFilters
      />
    </div>
  );
}
