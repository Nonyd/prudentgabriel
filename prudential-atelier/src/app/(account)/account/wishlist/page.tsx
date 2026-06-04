import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WishlistClient, type WishlistItemView } from "@/components/account/WishlistClient";

export default async function WishlistPage() {
  const session = await auth();
  const items = await prisma.wishlistItem.findMany({
    where: { userId: session!.user!.id! },
    include: {
      product: {
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          variants: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const view: WishlistItemView[] = items.map((w) => {
    const variants = w.product.variants;
    const inStock = variants.some((v) => v.stock > 0);
    const defaultVariant = variants.find((v) => v.stock > 0) ?? variants[0] ?? null;
    return {
      id: w.id,
      productId: w.productId,
      name: w.product.name,
      slug: w.product.slug,
      price: w.product.priceNGN,
      imageUrl: w.product.images[0]?.url ?? null,
      inStock,
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
