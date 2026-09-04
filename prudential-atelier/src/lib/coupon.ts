import { CouponType, CouponUsageStatus, ProductCategory, type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface CouponValidationResult {
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    type: CouponType;
    value: number;
    description: string | null;
  };
  discountNGN: number;
  isFreeShipping: boolean;
  error?: string;
}

export interface CartLineForCoupon {
  priceNGN: number;
  quantity: number;
  category?: ProductCategory;
}

type CouponDb = Prisma.TransactionClient | PrismaClient;

function formatMinAmount(n: number): string {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(n);
}

export async function validateCoupon(
  code: string,
  subtotalNGN: number,
  email: string,
  userId: string | null,
  cartLines: CartLineForCoupon[],
): Promise<CouponValidationResult> {
  const normalized = code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({
    where: { code: normalized },
  });

  if (!coupon) {
    return { valid: false, discountNGN: 0, isFreeShipping: false, error: "Invalid coupon code" };
  }

  if (!coupon.isActive) {
    return { valid: false, discountNGN: 0, isFreeShipping: false, error: "This coupon is no longer active" };
  }

  const now = new Date();
  if (now < coupon.startsAt) {
    return { valid: false, discountNGN: 0, isFreeShipping: false, error: "This coupon is not yet active" };
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { valid: false, discountNGN: 0, isFreeShipping: false, error: "This coupon has expired" };
  }

  if (coupon.maxUsesTotal != null && coupon.usedCount >= coupon.maxUsesTotal) {
    return { valid: false, discountNGN: 0, isFreeShipping: false, error: "This coupon has reached its usage limit" };
  }

  const emailLower = email.trim().toLowerCase();
  const usageCount = await prisma.couponUsage.count({
    where: {
      couponId: coupon.id,
      email: emailLower,
      status: { in: [CouponUsageStatus.PENDING, CouponUsageStatus.COMMITTED] },
    },
  });
  if (usageCount >= coupon.maxUsesPerUser) {
    return { valid: false, discountNGN: 0, isFreeShipping: false, error: "You have already used this coupon" };
  }

  if (coupon.minOrderNGN != null && subtotalNGN < coupon.minOrderNGN) {
    return {
      valid: false,
      discountNGN: 0,
      isFreeShipping: false,
      error: `Minimum order of ₦${formatMinAmount(coupon.minOrderNGN)} required`,
    };
  }

  if (!coupon.appliesToAll) {
    const catScope = coupon.categoryScope ?? [];
    if (catScope.length > 0) {
      const eligibleQty = cartLines
        .filter((l) => l.category != null && catScope.includes(l.category))
        .reduce((s, l) => s + l.quantity, 0);
      if (eligibleQty === 0) {
        return {
          valid: false,
          discountNGN: 0,
          isFreeShipping: false,
          error: "This coupon does not apply to items in your bag",
        };
      }
    }
  }

  let discountNGN = 0;
  let isFreeShipping = false;

  if (coupon.type === CouponType.PERCENTAGE) {
    discountNGN = Math.floor((subtotalNGN * coupon.value) / 100);
  } else if (coupon.type === CouponType.FIXED_AMOUNT) {
    discountNGN = Math.min(coupon.value, subtotalNGN);
  } else if (coupon.type === CouponType.FREE_SHIPPING) {
    discountNGN = 0;
    isFreeShipping = true;
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      description: coupon.description,
    },
    discountNGN,
    isFreeShipping,
  };
}

export async function reserveCouponUsage(
  db: CouponDb,
  params: { couponId: string; userId: string | null; email: string; orderId: string },
): Promise<void> {
  await db.coupon.update({
    where: { id: params.couponId },
    data: { usedCount: { increment: 1 } },
  });
  await db.couponUsage.create({
    data: {
      couponId: params.couponId,
      userId: params.userId,
      email: params.email,
      orderId: params.orderId,
      status: CouponUsageStatus.PENDING,
    },
  });
}

export async function commitCouponUsage(db: CouponDb, orderId: string): Promise<void> {
  const usage = await db.couponUsage.findUnique({ where: { orderId } });
  if (!usage || usage.status !== CouponUsageStatus.PENDING) return;
  await db.couponUsage.update({
    where: { id: usage.id },
    data: { status: CouponUsageStatus.COMMITTED, committedAt: new Date() },
  });
}

/** Only PENDING holds are released. A committed use (paid, then refunded) stays used. */
export async function releaseCouponUsage(db: CouponDb, orderId: string): Promise<boolean> {
  const usage = await db.couponUsage.findUnique({ where: { orderId } });
  if (!usage || usage.status !== CouponUsageStatus.PENDING) return false;
  await db.couponUsage.update({
    where: { id: usage.id },
    data: { status: CouponUsageStatus.RELEASED, releasedAt: new Date() },
  });
  await db.coupon.updateMany({
    where: { id: usage.couponId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
  return true;
}

/** Same order, new payment attempt: put a RELEASED hold back to PENDING. */
export async function rereserveCouponUsage(
  db: CouponDb,
  params: { orderId: string; couponId: string; userId: string | null; email: string },
): Promise<void> {
  const usage = await db.couponUsage.findUnique({ where: { orderId: params.orderId } });
  if (!usage) {
    await reserveCouponUsage(db, params);
    return;
  }
  if (usage.status === CouponUsageStatus.PENDING || usage.status === CouponUsageStatus.COMMITTED) {
    return;
  }

  const coupon = await db.coupon.findUnique({ where: { id: params.couponId } });
  if (!coupon) {
    throw new Error("This coupon is no longer available");
  }
  if (coupon.maxUsesTotal != null && coupon.usedCount >= coupon.maxUsesTotal) {
    throw new Error("This coupon has reached its usage limit");
  }

  await db.coupon.update({
    where: { id: params.couponId },
    data: { usedCount: { increment: 1 } },
  });
  await db.couponUsage.update({
    where: { id: usage.id },
    data: { status: CouponUsageStatus.PENDING, releasedAt: null },
  });
}
