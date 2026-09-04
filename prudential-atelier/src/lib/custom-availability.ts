import { prisma } from "@/lib/prisma";
import { hasPurchasableSize } from "@/lib/quick-add";
import { standardVariants } from "@/lib/custom-size";

export const CUSTOM_REMAKE_REFUSED = "This piece is sold out and cannot be remade.";
/** PDP always starts on standard. Custom is a tap, never an auto-switch. */
export const PDP_INITIAL_FIT_MODE = "standard" as const;

export function standardSizesSoldOut(variants: { size: string; stock: number }[]): boolean {
  return !hasPurchasableSize(standardVariants(variants));
}

export function isCustomOfferedNow(params: {
  customOffered: boolean;
  customOfferedWhenSoldOut: boolean;
  variants: { size: string; stock: number }[];
}): boolean {
  if (!params.customOffered) return false;
  if (!standardSizesSoldOut(params.variants)) return true;
  return params.customOfferedWhenSoldOut;
}

export async function assertCustomLineAllowed(
  productId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      customOffered: true,
      customOfferedWhenSoldOut: true,
      variants: { select: { size: true, stock: true } },
    },
  });
  if (!product) {
    return { ok: false, status: 404, error: "Product not found" };
  }
  if (!product.customOffered) {
    return { ok: false, status: 400, error: "This piece is not offered in custom measurements" };
  }
  if (
    !isCustomOfferedNow({
      customOffered: product.customOffered,
      customOfferedWhenSoldOut: product.customOfferedWhenSoldOut,
      variants: product.variants,
    })
  ) {
    return { ok: false, status: 400, error: CUSTOM_REMAKE_REFUSED };
  }
  return { ok: true };
}
