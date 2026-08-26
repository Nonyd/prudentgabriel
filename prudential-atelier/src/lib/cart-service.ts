import { prisma } from "@/lib/prisma";

export type CartLineInput = {
  productId: string;
  variantId: string;
  colorId?: string | null;
  quantity: number;
};

const cartInclude = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
  },
  variant: true,
  color: true,
} as const;

export async function listCartLines(userId: string) {
  return prisma.cartItem.findMany({
    where: { userId },
    include: cartInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function addCartLine(userId: string, input: CartLineInput) {
  const colorIdNorm = input.colorId?.trim() ? input.colorId : null;
  const quantity = Math.max(1, Math.floor(input.quantity));

  const variant = await prisma.productVariant.findUnique({
    where: { id: input.variantId },
    select: { id: true, stock: true, productId: true },
  });

  if (!variant || variant.productId !== input.productId) {
    return { ok: false as const, status: 400, error: "Invalid variant" };
  }
  if (variant.stock < 1) {
    return { ok: false as const, status: 400, error: "Out of stock" };
  }

  const existing = await prisma.cartItem.findFirst({
    where: { userId, variantId: input.variantId, colorId: colorIdNorm },
  });

  try {
    if (existing) {
      const nextQty = Math.min(existing.quantity + quantity, variant.stock);
      const cartItem = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQty },
        include: cartInclude,
      });
      return { ok: true as const, cartItem };
    }

    const cartItem = await prisma.cartItem.create({
      data: {
        userId,
        productId: input.productId,
        variantId: input.variantId,
        colorId: colorIdNorm,
        quantity: Math.min(quantity, variant.stock),
      },
      include: cartInclude,
    });
    return { ok: true as const, cartItem };
  } catch {
    return { ok: false as const, status: 400, error: "Could not add to bag." };
  }
}

export async function updateCartLineQty(userId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, userId },
    include: { variant: true },
  });
  if (!item) return { ok: false as const, status: 404, error: "Not found" };
  if (quantity > item.variant.stock) {
    return { ok: false as const, status: 400, error: "Quantity exceeds stock" };
  }
  const cartItem = await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity },
    include: cartInclude,
  });
  return { ok: true as const, cartItem };
}

export async function removeCartLine(userId: string, itemId: string) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, userId },
  });
  if (!item) return { ok: false as const, status: 404, error: "Not found" };
  await prisma.cartItem.delete({ where: { id: item.id } });
  return { ok: true as const };
}
