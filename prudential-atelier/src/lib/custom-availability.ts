import { prisma } from "@/lib/prisma";

/** PDP always starts on standard. Custom is a tap, never an auto-switch. */
export const PDP_INITIAL_FIT_MODE = "standard" as const;

export function isCustomOfferedNow(params: { customOffered: boolean }): boolean {
  return params.customOffered;
}

export async function assertCustomLineAllowed(
  productId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { customOffered: true },
  });
  if (!product) {
    return { ok: false, status: 404, error: "Product not found" };
  }
  if (!product.customOffered) {
    return { ok: false, status: 400, error: "This piece is not offered in custom measurements" };
  }
  return { ok: true };
}
