import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus, Prisma, ProductCategory, ShippingQuoteStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import { validateCoupon } from "@/lib/coupon";
import { generateOrderNumber } from "@/lib/order-number";
import { redeemPoints } from "@/lib/points";
import { generatePaymentReference } from "@/lib/payments/index";
import { getSupportedGateways } from "@/lib/payments/config";
import { notifyNewOrder } from "@/lib/notifications";
import { orderCreateBodySchema, type AddressInput } from "@/validations/order";
import { resolveCheckoutShipping } from "@/lib/shipping/resolve-selection";
import { generateCollectionCode } from "@/lib/shipping/collection";
import { getLockedFx, lockForeignTotals, usdOverrideOrConvert, gbpOverrideOrConvert } from "@/lib/fx";
import { effectiveUnitNGN, resolveCurrencyOverride } from "@/lib/pricing";
import type { CartParcelLine } from "@/lib/shipping/options";

function snapshotFromAddress(a: AddressInput) {
  return {
    firstName: a.firstName,
    lastName: a.lastName,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    country: a.country,
    postalCode: a.postalCode,
    phone: a.phone,
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = orderCreateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const shippingOptionId = data.shippingOptionId || data.shippingZoneId;
  if (!shippingOptionId) {
    return NextResponse.json({ error: "Choose a shipping method" }, { status: 400 });
  }

  if (!userId) {
    if (!data.guestEmail?.trim()) {
      return NextResponse.json({ error: "guestEmail is required for guest checkout" }, { status: 400 });
    }
    if (!data.cartLines?.length) {
      return NextResponse.json({ error: "cartLines required for guest checkout" }, { status: 400 });
    }
  }

  if (userId && data.addressId && data.address) {
    return NextResponse.json({ error: "Provide either addressId or address, not both" }, { status: 400 });
  }

  type Line = {
    productId: string;
    variantId: string;
    quantity: number;
    size: string;
    color?: string;
    colorHex?: string;
    colorId?: string;
    unitPrice: number;
    unitUsd: number;
    unitGbp: number;
    category: ProductCategory;
    productName: string;
    parcel: CartParcelLine;
  };

  function lineFromVariant(params: {
    productId: string;
    variant: {
      id: string;
      size: string;
      priceNGN: number;
      salePriceNGN: number | null;
      priceUSD: number | null;
      priceGBP: number | null;
      weightKg: number | null;
      lengthCm: number | null;
      widthCm: number | null;
      heightCm: number | null;
    };
    product: {
      name: string;
      category: ProductCategory;
      isOnSale: boolean;
      priceUSD: number | null;
      priceGBP: number | null;
      defaultWeightKg: number | null;
      defaultLengthCm: number | null;
      defaultWidthCm: number | null;
      defaultHeightCm: number | null;
    };
    quantity: number;
    color?: string;
    colorHex?: string;
    colorId?: string;
    fx: Awaited<ReturnType<typeof getLockedFx>>;
  }): Line {
    const unit = effectiveUnitNGN(params.variant, params.product.isOnSale);
    const overrideUsd = resolveCurrencyOverride("USD", params.variant, params.product);
    const overrideGbp = resolveCurrencyOverride("GBP", params.variant, params.product);
    return {
      productId: params.productId,
      variantId: params.variant.id,
      quantity: params.quantity,
      size: params.variant.size,
      color: params.color,
      colorHex: params.colorHex,
      colorId: params.colorId,
      unitPrice: unit,
      unitUsd: usdOverrideOrConvert(unit, overrideUsd, params.fx),
      unitGbp: gbpOverrideOrConvert(unit, overrideGbp, params.fx),
      category: params.product.category,
      productName: params.product.name,
      parcel: {
        quantity: params.quantity,
        variant: {
          weightKg: params.variant.weightKg ?? undefined,
          lengthCm: params.variant.lengthCm ?? undefined,
          widthCm: params.variant.widthCm ?? undefined,
          heightCm: params.variant.heightCm ?? undefined,
        },
        product: {
          weightKg: params.product.defaultWeightKg ?? undefined,
          lengthCm: params.product.defaultLengthCm ?? undefined,
          widthCm: params.product.defaultWidthCm ?? undefined,
          heightCm: params.product.defaultHeightCm ?? undefined,
        },
      },
    };
  }

  const fx = await getLockedFx();
  let lines: Line[] = [];

  const productPriceSelect = {
    id: true,
    name: true,
    category: true,
    isOnSale: true,
    priceUSD: true,
    priceGBP: true,
    defaultWeightKg: true,
    defaultLengthCm: true,
    defaultWidthCm: true,
    defaultHeightCm: true,
  } as const;

  if (userId) {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: { select: productPriceSelect },
        variant: true,
        color: true,
      },
    });

    if (!cartItems.length) {
      return NextResponse.json({ error: "Your bag is empty" }, { status: 400 });
    }

    lines = cartItems.map((ci) =>
      lineFromVariant({
        productId: ci.productId,
        variant: ci.variant,
        product: ci.product,
        quantity: ci.quantity,
        color: ci.color?.name,
        colorHex: ci.color?.hex,
        colorId: ci.colorId ?? undefined,
        fx,
      }),
    );
  } else {
    const guestLines = data.cartLines ?? [];
    for (const gl of guestLines) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: gl.variantId },
        include: { product: { select: productPriceSelect } },
      });
      if (!variant || variant.productId !== gl.productId) {
        return NextResponse.json({ error: "Invalid cart item" }, { status: 400 });
      }
      lines.push(
        lineFromVariant({
          productId: gl.productId,
          variant,
          product: variant.product,
          quantity: gl.quantity,
          color: gl.color,
          colorHex: gl.colorHex,
          colorId: gl.colorId,
          fx,
        }),
      );
    }
  }

  for (const line of lines) {
    const v = await prisma.productVariant.findUnique({
      where: { id: line.variantId },
      select: { stock: true, product: { select: { name: true } } },
    });
    if (!v || v.stock < line.quantity) {
      return NextResponse.json(
        { error: `Insufficient stock for ${v?.product.name ?? "an item"}` },
        { status: 400 },
      );
    }
  }

  const subtotalNGN = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  const emailForCoupon = (userId ? session?.user?.email : data.guestEmail)?.trim().toLowerCase() ?? "";
  if (!emailForCoupon) {
    return NextResponse.json({ error: "Email required for checkout" }, { status: 400 });
  }

  const isPickupOption = shippingOptionId.startsWith("pickup:");

  let resolvedAddress: AddressInput | null = null;
  let addressSnapshot: Record<string, unknown> | null = null;

  if (data.addressId) {
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const addr = await prisma.address.findFirst({
      where: { id: data.addressId, userId },
    });
    if (!addr) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    resolvedAddress = {
      firstName: addr.firstName,
      lastName: addr.lastName,
      phone: addr.phone,
      line1: addr.street,
      line2: addr.addressLine2 ?? undefined,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode ?? undefined,
      country: addr.country,
      saveAddress: false,
    };
    addressSnapshot = {
      firstName: addr.firstName,
      lastName: addr.lastName,
      line1: addr.street,
      line2: addr.addressLine2,
      city: addr.city,
      state: addr.state,
      country: addr.country,
      postalCode: addr.postalCode,
      phone: addr.phone,
    };
  } else if (data.address) {
    resolvedAddress = data.address;
    addressSnapshot = snapshotFromAddress(resolvedAddress);
  } else if (isPickupOption && data.pickupContact) {
    resolvedAddress = {
      firstName: data.pickupContact.firstName,
      lastName: data.pickupContact.lastName,
      phone: data.pickupContact.phone,
      line1: "Collection",
      city: data.pickupContact.city || "Lagos",
      state: data.pickupContact.state || "Lagos",
      country: data.pickupContact.country || "NG",
      saveAddress: false,
    };
    addressSnapshot = {
      firstName: data.pickupContact.firstName,
      lastName: data.pickupContact.lastName,
      phone: data.pickupContact.phone,
      pickup: true,
      country: data.pickupContact.country || "NG",
      state: data.pickupContact.state || "Lagos",
      city: data.pickupContact.city || "Lagos",
    };
  }

  const destCountry = resolvedAddress?.country ?? data.pickupContact?.country ?? "NG";
  const destState = resolvedAddress?.state ?? data.pickupContact?.state ?? (isPickupOption ? "Lagos" : "");
  const destCity = resolvedAddress?.city ?? data.pickupContact?.city ?? "";

  if (!isPickupOption && !resolvedAddress) {
    return NextResponse.json({ error: "Delivery address is required" }, { status: 400 });
  }

  let discountNGN = 0;
  let couponId: string | undefined;
  let couponCode: string | undefined;
  let isFreeShippingCoupon = false;

  if (data.couponCode?.trim()) {
    const couponResult = await validateCoupon(
      data.couponCode,
      subtotalNGN,
      emailForCoupon,
      userId,
      lines.map((l) => ({
        priceNGN: l.unitPrice,
        quantity: l.quantity,
        category: l.category,
      })),
    );
    if (!couponResult.valid) {
      return NextResponse.json({ error: couponResult.error ?? "Invalid coupon" }, { status: 400 });
    }
    discountNGN = couponResult.discountNGN;
    isFreeShippingCoupon = couponResult.isFreeShipping;
    couponId = couponResult.coupon?.id;
    couponCode = couponResult.coupon?.code;
  }

  const shippingResolved = await resolveCheckoutShipping({
    optionId: shippingOptionId,
    destination: {
      country: destCountry,
      state: destState,
      city: destCity,
    },
    subtotalNGN,
    lines: lines.map((l) => l.parcel),
    isFreeShippingCoupon,
  });

  if (!shippingResolved.ok) {
    return NextResponse.json({ error: shippingResolved.error }, { status: 400 });
  }

  const ship = shippingResolved.shipping;

  if (ship.requiresAddress && !resolvedAddress) {
    return NextResponse.json({ error: "A free-text address cannot be priced — choose country and state" }, { status: 400 });
  }

  if (ship.requiresConsent) {
    if (!data.shippingConsent) {
      return NextResponse.json({ error: "Please confirm you understand shipping will be quoted separately" }, { status: 400 });
    }
  }

  const shippingAfterCoupon = ship.shippingAmount;

  let pointsDiscNGN = 0;
  const pointsToRedeem = data.pointsToRedeem ?? 0;

  if (pointsToRedeem > 0) {
    if (!userId) {
      return NextResponse.json({ error: "Must be logged in to use points" }, { status: 400 });
    }
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true },
    });
    if (!u || u.pointsBalance < pointsToRedeem) {
      return NextResponse.json({ error: "Insufficient points" }, { status: 400 });
    }
    pointsDiscNGN = pointsToRedeem;
    const maxPointsDisc = Math.max(0, subtotalNGN + shippingAfterCoupon - discountNGN);
    if (pointsDiscNGN > maxPointsDisc) {
      pointsDiscNGN = Math.floor(maxPointsDisc);
    }
  }

  let totalNGN = subtotalNGN + shippingAfterCoupon - discountNGN - pointsDiscNGN;
  if (totalNGN < 0) totalNGN = 0;

  const gatewayMap: Record<string, PaymentGateway> = {
    PAYSTACK: PaymentGateway.PAYSTACK,
    FLUTTERWAVE: PaymentGateway.FLUTTERWAVE,
    STRIPE: PaymentGateway.STRIPE,
    MONNIFY: PaymentGateway.MONNIFY,
    BANK_TRANSFER: PaymentGateway.BANK_TRANSFER,
  };
  const paymentGateway = gatewayMap[data.gateway];
  const offered = await getSupportedGateways(data.currency, "RTW");
  if (!offered.includes(data.gateway)) {
    return NextResponse.json({ error: "That payment method is not available for this currency" }, { status: 400 });
  }
  const paymentRef =
    data.paymentRef && /^PA-ORDER-/i.test(data.paymentRef)
      ? data.paymentRef
      : generatePaymentReference("ORDER");

  const itemUsd = lines.reduce((s, l) => s + l.unitUsd * l.quantity, 0);
  const itemGbp = lines.reduce((s, l) => s + l.unitGbp * l.quantity, 0);
  const extrasNGN = shippingAfterCoupon - discountNGN - pointsDiscNGN;
  const lockedForeign = lockForeignTotals({ itemUsd, itemGbp, extrasNGN, fx });
  const orderNumber = generateOrderNumber();
  const collectionCode = ship.kind === "PICKUP" ? generateCollectionCode() : null;
  const consentAt = ship.requiresConsent ? new Date() : null;
  const consentText = ship.requiresConsent ? (data.shippingConsentText?.trim() || ship.consentText) : null;

  try {
    const order = await prisma.$transaction(async (tx) => {
      const orderRow = await tx.order.create({
        data: {
          orderNumber,
          userId,
          guestEmail: userId ? null : data.guestEmail?.trim().toLowerCase() ?? null,
          guestName: userId ? null : data.guestName ?? null,
          guestPhone: userId ? null : data.guestPhone ?? null,
          subtotal: subtotalNGN,
          shippingAmount: shippingAfterCoupon,
          discount: discountNGN,
          pointsDiscountNGN: pointsDiscNGN,
          pointsUsed: pointsDiscNGN,
          total: totalNGN,
          currency: data.currency,
          addressSnapshot: (addressSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
          shippingMethodId: ship.methodId,
          shippingMethodKind: ship.kind,
          lagosLocationId: ship.lagosLocationId,
          pickupLocationId: ship.pickupLocationId,
          shippingQuoteStatus: ship.quoteStatus,
          shippingQuoteLocked: ship.quoteLocked as Prisma.InputJsonValue | undefined,
          shippingConsentAt: consentAt,
          shippingConsentText: consentText,
          preferredContactMethod: ship.requiresConsent ? (data.preferredContactMethod ?? null) : null,
          collectionCode,
          fxRateLocked: fx.rate,
          fxGbpRateLocked: fx.gbpRate,
          fxRateSource: fx.source,
          fxRateFetchedAt: fx.fetchedAt,
          fxRateStale: fx.stale,
          fxUsdAmountLocked: lockedForeign.fxUsdAmountLocked,
          fxGbpAmountLocked: lockedForeign.fxGbpAmountLocked,
          amountPaid: 0,
          balance: totalNGN,
          couponId,
          couponCode: couponCode ?? null,
          paymentGateway,
          paymentRef,
          paymentStatus: PaymentStatus.PENDING,
          notes: data.notes ?? null,
          isGift: data.isGift ?? false,
          giftMessage: data.giftMessage ?? null,
        },
      });

      for (const line of lines) {
        const lineTotal = line.unitPrice * line.quantity;
        await tx.orderItem.create({
          data: {
            orderId: orderRow.id,
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
            size: line.size,
            color: line.color ?? null,
            colorHex: line.colorHex ?? null,
            price: line.unitPrice,
            lineTotal,
          },
        });
      }

      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
        await tx.couponUsage.create({
          data: {
            couponId,
            userId,
            email: emailForCoupon,
            orderId: orderRow.id,
          },
        });
      }

      if (pointsDiscNGN > 0 && userId) {
        await redeemPoints(userId, pointsDiscNGN, orderRow.id, tx);
      }

      if (userId) {
        await tx.cartItem.deleteMany({ where: { userId } });
      }

      return orderRow;
    }, INTERACTIVE_TX);

    if (userId && data.address?.saveAddress && data.address && !isPickupOption) {
      await prisma.address.create({
        data: {
          userId,
          firstName: resolvedAddress!.firstName,
          lastName: resolvedAddress!.lastName,
          phone: resolvedAddress!.phone,
          street: resolvedAddress!.line1,
          addressLine2: resolvedAddress!.line2 ?? null,
          postalCode: resolvedAddress!.postalCode ?? null,
          city: resolvedAddress!.city,
          state: resolvedAddress!.state,
          country: resolvedAddress!.country,
          isDefault: false,
        },
      });
    }

    void notifyNewOrder(order);

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalNGN: order.total,
      currency: data.currency,
      paymentRef: order.paymentRef,
      shippingQuoteStatus: order.shippingQuoteStatus,
      collectionCode: order.collectionCode,
      fxRateLocked: order.fxRateLocked,
      fxRateStale: order.fxRateStale,
      quotePending: order.shippingQuoteStatus === ShippingQuoteStatus.QUOTE_PENDING,
    });
  } catch (e) {
    console.error("[orders/create]", e);
    return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  }
}
