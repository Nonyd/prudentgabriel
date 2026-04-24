import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus, Prisma, ProductCategory } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateCoupon } from "@/lib/coupon";
import { calculateShippingOptions } from "@/lib/shipping";
import { generateOrderNumber } from "@/lib/order-number";
import { redeemPoints } from "@/lib/points";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { notifyLowStock, notifyNewOrder } from "@/lib/notifications";
import { orderCreateBodySchema, type AddressInput } from "@/validations/order";

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

  if (!data.addressId && !data.address) {
    return NextResponse.json({ error: "Delivery address is required" }, { status: 400 });
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
    category: ProductCategory;
    productName: string;
  };

  let lines: Line[] = [];

  if (userId) {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: { select: { id: true, name: true, category: true } },
        variant: true,
        color: true,
      },
    });

    if (!cartItems.length) {
      return NextResponse.json({ error: "Your bag is empty" }, { status: 400 });
    }

    lines = cartItems.map((ci) => {
      const unit = ci.variant.salePriceNGN ?? ci.variant.priceNGN;
      return {
        productId: ci.productId,
        variantId: ci.variantId,
        quantity: ci.quantity,
        size: ci.variant.size,
        color: ci.color?.name,
        colorHex: ci.color?.hex,
        colorId: ci.colorId ?? undefined,
        unitPrice: unit,
        category: ci.product.category,
        productName: ci.product.name,
      };
    });
  } else {
    const guestLines = data.cartLines ?? [];
    for (const gl of guestLines) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: gl.variantId },
        include: { product: { select: { id: true, name: true, category: true } } },
      });
      if (!variant || variant.productId !== gl.productId) {
        return NextResponse.json({ error: "Invalid cart item" }, { status: 400 });
      }
      const unit = variant.salePriceNGN ?? variant.priceNGN;
      lines.push({
        productId: gl.productId,
        variantId: gl.variantId,
        quantity: gl.quantity,
        size: gl.size,
        color: gl.color,
        colorHex: gl.colorHex,
        colorId: gl.colorId,
        unitPrice: unit,
        category: variant.product.category,
        productName: variant.product.name,
      });
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

  let resolvedAddress: AddressInput;
  let addressSnapshot: Record<string, unknown>;

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
  } else {
    resolvedAddress = data.address as AddressInput;
    addressSnapshot = snapshotFromAddress(resolvedAddress);
  }

  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  const totalWeightKg = Math.max(0.5, totalQty * 0.5);

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

  const shippingOpts = await calculateShippingOptions(
    {
      city: resolvedAddress.city,
      state: resolvedAddress.state,
      country: resolvedAddress.country,
    },
    subtotalNGN,
    totalWeightKg,
    isFreeShippingCoupon,
  );

  const selectedOpt =
    data.shippingZoneId === "manual"
      ? shippingOpts.find((o) => o.zoneId === "manual")
      : shippingOpts.find((o) => o.zoneId === data.shippingZoneId);

  if (!selectedOpt && data.shippingZoneId !== "manual") {
    return NextResponse.json({ error: "Invalid shipping zone" }, { status: 400 });
  }

  const shippingZoneIdToSave = data.shippingZoneId === "manual" ? null : data.shippingZoneId;

  if (data.shippingZoneId !== "manual") {
    const zone = await prisma.shippingZone.findFirst({
      where: { id: data.shippingZoneId, isActive: true },
    });
    if (!zone) {
      return NextResponse.json({ error: "Shipping zone not found" }, { status: 400 });
    }
  }

  const shippingAfterCoupon = data.shippingZoneId === "manual" ? 0 : (selectedOpt?.costNGN ?? 0);

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
  };
  const paymentGateway = gatewayMap[data.gateway];

  const orderNumber = generateOrderNumber();

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
          addressSnapshot: addressSnapshot as Prisma.InputJsonValue,
          shippingZoneId: shippingZoneIdToSave,
          couponId,
          couponCode: couponCode ?? null,
          paymentGateway,
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

        await tx.productVariant.update({
          where: { id: line.variantId },
          data: { stock: { decrement: line.quantity } },
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
    });

    if (userId && data.address?.saveAddress && data.address) {
      await prisma.address.create({
        data: {
          userId,
          firstName: resolvedAddress.firstName,
          lastName: resolvedAddress.lastName,
          phone: resolvedAddress.phone,
          street: resolvedAddress.line1,
          addressLine2: resolvedAddress.line2 ?? null,
          postalCode: resolvedAddress.postalCode ?? null,
          city: resolvedAddress.city,
          state: resolvedAddress.state,
          country: resolvedAddress.country,
          isDefault: false,
        },
      });
    }

    void sendOrderConfirmationEmail({
      to: emailForCoupon,
      firstName: resolvedAddress.firstName,
      orderNumber: order.orderNumber,
      items: lines.map((l) => ({
        name: l.productName,
        size: l.size,
        color: l.color,
        qty: l.quantity,
        priceNGN: l.unitPrice,
      })),
      subtotalNGN,
      totalNGN: order.total,
      shippingNGN: order.shippingAmount,
      discountNGN: order.discount,
      pointsDiscNGN: order.pointsDiscountNGN,
      addressSnapshot: addressSnapshot as Record<string, string>,
    });

    void notifyNewOrder(order);

    for (const line of lines) {
      const v = await prisma.productVariant.findUnique({
        where: { id: line.variantId },
        include: { product: { select: { name: true } } },
      });
      if (v && v.stock <= v.lowStockAt) {
        void notifyLowStock(v.product, v);
      }
    }

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalNGN: order.total,
      currency: data.currency,
    });
  } catch (e) {
    console.error("[orders/create]", e);
    return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  }
}
