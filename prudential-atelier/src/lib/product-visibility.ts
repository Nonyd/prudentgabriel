import { prisma } from "@/lib/prisma";

/**
 * isPublished is a rule, not a display filter: nothing outside the admin shows,
 * links, sells, emails or accepts an unpublished piece. Use this where-fragment
 * on every product query or product relation that reaches a customer, and
 * publishedProductIds() where products arrive as ids (snapshots, bags).
 *
 * Exceptions, by design: a customer's own past orders (they bought it), and the
 * admin. Buying is gated separately by product-orderability.ts.
 */
export const PUBLIC_PRODUCT_WHERE = { isPublished: true } as const;

export async function publishedProductIds(ids: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Set();
  const rows = await prisma.product.findMany({
    where: { id: { in: unique }, ...PUBLIC_PRODUCT_WHERE },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}
