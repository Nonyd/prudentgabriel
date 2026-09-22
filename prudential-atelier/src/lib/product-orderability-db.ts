import { prisma } from "@/lib/prisma";
import { unorderableMessage, whyUnorderable } from "@/lib/product-orderability";

/**
 * Server check for the cart and checkout: every product must be orderable
 * (published, and something to order). Returns the first refusal, or null.
 */
export async function firstUnorderableProduct(
  productIds: string[],
): Promise<{ productId: string; error: string } | null> {
  const ids = Array.from(new Set(productIds));
  if (ids.length === 0) return null;
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, isPublished: true, customOffered: true, variants: { select: { size: true } } },
  });
  for (const id of ids) {
    const p = products.find((x) => x.id === id);
    if (!p) return { productId: id, error: "A piece in your bag is no longer available. Please remove it." };
    const why = whyUnorderable(p);
    if (why) return { productId: id, error: unorderableMessage(p.name, why) };
  }
  return null;
}
