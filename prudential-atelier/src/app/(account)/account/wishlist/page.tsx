import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/common/ProductCard";
import { mapProductToListItem } from "@/lib/map-product-list-item";

export default async function WishlistPage() {
  const session = await auth();
  const items = await prisma.wishlistItem.findMany({
    where: { userId: session!.user!.id! },
    include: {
      product: {
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          variants: { orderBy: { sortOrder: "asc" } },
          colors: true,
          _count: { select: { reviews: true } },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="font-display text-3xl text-wine">My wishlist ({items.length})</h1>
      {items.length === 0 ? (
        <div className="mt-12 text-center text-charcoal-mid">
          <p>Nothing saved yet.</p>
          <Link href="/shop" className="mt-4 inline-block text-wine underline">
            Browse collection
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((w) => (
            <ProductCard key={w.id} product={mapProductToListItem(w.product)} />
          ))}
        </div>
      )}
    </div>
  );
}
