import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/product-visibility";
import { WishlistClient, type WishlistItemView } from "@/components/account/WishlistClient";
import { derivedCatalogMinNGN } from "@/lib/pricing";

export default async function WishlistPage() {
  const session = await auth();
  const items = await prisma.wishlistItem.findMany({
    // A withdrawn piece drops out of the wishlist.
    where: { userId: session!.user!.id!, product: PUBLIC_PRODUCT_WHERE },
    include: {
      product: {
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          variants: { orderBy: { sortOrder: "asc" } },
          optionGroup: { select: { options: { select: { priceAdjustmentNGN: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const view: WishlistItemView[] = items.map((w) => {
    const variants = w.product.variants;
    const defaultVariant = variants[0] ?? null;
    return {
      id: w.id,
      productId: w.productId,
      name: w.product.name,
      slug: w.product.slug,
      price: variants.length
        ? derivedCatalogMinNGN(variants, w.product.isOnSale, w.product.optionGroup?.options)
        : w.product.priceNGN,
      imageUrl: w.product.images[0]?.url ?? null,
      defaultVariantId: defaultVariant?.id ?? null,
      defaultSize: defaultVariant?.size ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-4xl text-choc">Wishlist</h1>
      <p className="mt-2 font-sans text-sm text-text-mid">{view.length} saved items</p>
      <WishlistClient items={view} />
    </div>
  );
}
