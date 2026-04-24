"use client";

import Image from "next/image";
import type { CartItem } from "@/store/cartStore";
import { formatPrice, getExchangeRates, convertFromNGN } from "@/lib/currency";
import type { ShopCurrency } from "@/lib/currency";
import { useEffect, useState } from "react";

interface CouponResult {
  valid: boolean;
  discountNGN: number;
  isFreeShipping: boolean;
}

export function OrderSummary({
  items,
  couponResult,
  pointsToRedeem,
  shippingCostNGN,
  currency,
  step,
}: {
  items: CartItem[];
  couponResult: CouponResult | null;
  pointsToRedeem: number;
  shippingCostNGN: number | null;
  currency: ShopCurrency;
  step: number;
}) {
  const [rates, setRates] = useState({ NGN: 1580, USD: 1, GBP: 0.79 });

  useEffect(() => {
    void getExchangeRates().then(setRates);
  }, []);

  const subtotal = items.reduce((s, i) => s + i.priceNGN * i.quantity, 0);
  const disc = couponResult?.valid ? couponResult.discountNGN : 0;
  const ship = shippingCostNGN ?? 0;
  const pts = pointsToRedeem;
  const total = Math.max(0, subtotal + ship - disc - pts);

  const conv = (n: number) => convertFromNGN(n, currency, rates);
  const fmt = (n: number) => formatPrice(conv(n), currency);

  return (
    <div className="rounded-sm border border-border bg-cream p-5">
      <h3 className="font-display text-lg text-wine">Order summary</h3>
      <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
        {step > 1 ? (
          <li className="text-sm text-charcoal-mid">{items.length} items</li>
        ) : (
          items.map((i) => (
            <li key={i.id} className="flex gap-3 text-sm">
              <Image src={i.imageUrl} alt="" width={48} height={60} className="rounded-sm object-cover" />
              <div className="flex-1">
                <p className="font-medium text-charcoal">{i.productName}</p>
                <p className="text-charcoal-mid">
                  {i.size} ×{i.quantity}
                </p>
              </div>
              <p>{fmt(i.priceNGN * i.quantity)}</p>
            </li>
          ))
        )}
      </ul>
      <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-charcoal-mid">Subtotal</span>
          <span>{fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-charcoal-mid">Shipping</span>
          <span>{shippingCostNGN == null ? "—" : ship === 0 ? <span className="text-gold">Free</span> : fmt(ship)}</span>
        </div>
        {disc > 0 && (
          <div className="flex justify-between text-success">
            <span>Coupon</span>
            <span>−{fmt(disc)}</span>
          </div>
        )}
        {pts > 0 && (
          <div className="flex justify-between text-gold">
            <span>Points</span>
            <span>−{fmt(pts)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 font-display text-lg text-wine">
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>
      </div>
      {step < 3 && (
        <p className="mt-3 font-label text-[11px] text-gold">
          Earn ~{Math.floor(total / 100)} pts with this order
        </p>
      )}
    </div>
  );
}
