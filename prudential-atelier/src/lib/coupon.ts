import { CouponType, ProductCategory } from "@prisma/client";
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
    where: { couponId: coupon.id, email: emailLower },
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
