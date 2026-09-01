import { Prisma, SizeMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cartLineKey,
  customSurchargeNGN,
  isCustomLine,
  resolveCustomPolicy,
  standardVariants,
  validateCustomMeasurements,
  type TypedMeasurement,
} from "@/lib/custom-size";
import { getCustomGlobals } from "@/lib/custom-settings";
import { effectiveUnitNGN } from "@/lib/pricing";

function isMissingCartUserError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2003") {
    return false;
  }
  return String(error.meta?.field_name ?? "").includes("userId");
}

export type CartLineInput = {
  productId: string;
  variantId?: string | null;
  colorId?: string | null;
  quantity: number;
  sizeMode?: SizeMode | "STANDARD" | "CUSTOM";
  measurements?: TypedMeasurement[];
  typedUnit?: string | null;
};

const cartInclude = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      isOnSale: true,
      priceNGN: true,
      priceUSD: true,
      priceGBP: true,
      customOffered: true,
      customSurchargeKind: true,
      customSurchargeValue: true,
      customLeadTimeDays: true,
      customReturnable: true,
      images: { where: { isPrimary: true }, take: 1 },
      variants: {
        orderBy: { priceNGN: "asc" as const },
        take: 1,
        select: {
          priceNGN: true,
          salePriceNGN: true,
          priceUSD: true,
          priceGBP: true,
        },
      },
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
  const sizeMode: SizeMode = input.sizeMode === "CUSTOM" ? "CUSTOM" : "STANDARD";

  if (sizeMode === "CUSTOM") {
    return addCustomLine(userId, input, colorIdNorm, quantity);
  }

  const variantId = input.variantId?.trim();
  if (!variantId) {
    return { ok: false as const, status: 400, error: "Invalid variant" };
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, stock: true, productId: true, size: true },
  });

  if (!variant || variant.productId !== input.productId) {
    return { ok: false as const, status: 400, error: "Invalid variant" };
  }
  if (variant.size.trim().toLowerCase() === "custom") {
    return { ok: false as const, status: 400, error: "Use made-to-measure on the product page" };
  }
  if (variant.stock < 1) {
    return { ok: false as const, status: 400, error: "Out of stock" };
  }

  const lineKey = cartLineKey({ sizeMode: "STANDARD", productId: input.productId, variantId, colorId: colorIdNorm });
  const existing = await prisma.cartItem.findFirst({
    where: { userId, lineKey },
  });

  try {
    if (existing) {
      const nextQty = Math.min(existing.quantity + quantity, variant.stock);
      const cartItem = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQty, variantId, sizeMode: "STANDARD" },
        include: cartInclude,
      });
      return { ok: true as const, cartItem };
    }

    const cartItem = await prisma.cartItem.create({
      data: {
        userId,
        productId: input.productId,
        variantId,
        colorId: colorIdNorm,
        quantity: Math.min(quantity, variant.stock),
        sizeMode: "STANDARD",
        lineKey,
      },
      include: cartInclude,
    });
    return { ok: true as const, cartItem };
  } catch (error) {
    if (isMissingCartUserError(error)) {
      return { ok: false as const, status: 401, error: "Please sign in again." };
    }
    console.error("[cart] addCartLine failed", error);
    return { ok: false as const, status: 400, error: "Could not add to bag." };
  }
}

async function addCustomLine(
  userId: string,
  input: CartLineInput,
  colorIdNorm: string | null,
  quantity: number,
) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: {
      measurementFields: { include: { field: true }, orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { priceNGN: "asc" } },
    },
  });
  if (!product?.customOffered) {
    return { ok: false as const, status: 400, error: "This piece is not offered in custom measurements" };
  }
  const fields = product.measurementFields.map((pm) => ({
    key: pm.field.key,
    label: pm.field.label,
    helpText: pm.field.helpText,
    minCm: pm.field.minCm,
    maxCm: pm.field.maxCm,
    required: pm.required,
    sortOrder: pm.sortOrder,
  }));
  if (!fields.length) {
    return { ok: false as const, status: 400, error: "No measurements are configured for this piece" };
  }
  const checked = validateCustomMeasurements(fields, input.measurements ?? []);
  if (!checked.ok) {
    return { ok: false as const, status: 400, error: checked.errors[0]?.message ?? "Check your measurements" };
  }

  const globals = await getCustomGlobals();
  const policy = resolveCustomPolicy({ product, globals });
  const pricedPool = standardVariants(product.variants);
  const cheapest = (pricedPool.length ? pricedPool : product.variants)
    .slice()
    .sort((a, b) => a.priceNGN - b.priceNGN)[0];
  const unit = cheapest ? effectiveUnitNGN(cheapest, product.isOnSale) : product.priceNGN;
  const surchargeNGN = customSurchargeNGN({
    unitNGN: unit,
    kind: policy.surchargeKind,
    value: policy.surchargeValue,
  });

  const lineKey = cartLineKey({
    sizeMode: "CUSTOM",
    productId: input.productId,
    colorId: colorIdNorm,
  });

  try {
    const existing = await prisma.cartItem.findFirst({ where: { userId, lineKey } });
    const data = {
      quantity,
      measurements: checked.snapshot as unknown as Prisma.InputJsonValue,
      typedUnit: input.typedUnit ?? checked.snapshot[0]?.typedUnit ?? "cm",
      surchargeNGN,
      sizeMode: SizeMode.CUSTOM,
      variantId: null,
      colorId: colorIdNorm,
    };
    if (existing) {
      const cartItem = await prisma.cartItem.update({
        where: { id: existing.id },
        data,
        include: cartInclude,
      });
      return { ok: true as const, cartItem };
    }
    const cartItem = await prisma.cartItem.create({
      data: {
        userId,
        productId: input.productId,
        lineKey,
        ...data,
      },
      include: cartInclude,
    });
    return { ok: true as const, cartItem };
  } catch (error) {
    if (isMissingCartUserError(error)) {
      return { ok: false as const, status: 401, error: "Please sign in again." };
    }
    console.error("[cart] addCustomLine failed", error);
    return { ok: false as const, status: 400, error: "Could not add to bag." };
  }
}

export async function updateCartLineQty(userId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, userId },
    include: { variant: true },
  });
  if (!item) return { ok: false as const, status: 404, error: "Not found" };
  if (!isCustomLine(item.sizeMode) && item.variant && quantity > item.variant.stock) {
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
