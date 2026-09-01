"use client";

import Image from "next/image";
import type { CartItem } from "@/store/cartStore";
import { formatPrice, type ExchangeRatesNGN, type ShopCurrency } from "@/lib/currency";
import { cartLineAmountInCurrency, extrasAmountInCurrency } from "@/lib/pricing";
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
  pointsValueNGN,
  shippingCostNGN,
  currency,
  step,
  pointRate,
}: {
  items: CartItem[];
  couponResult: CouponResult | null;
  pointsToRedeem: number;
  pointsValueNGN: number;
  shippingCostNGN: number | null;
  currency: ShopCurrency;
  step: number;
  pointRate: number;
}) {
  const [rates, setRates] = useState<ExchangeRatesNGN>({ NGN: 1, USD: 0.00065, GBP: 0.00052 });

  useEffect(() => {
    void fetch("/api/currency/rates")
      .then((r) => r.json())
      .then((j: ExchangeRatesNGN) => {
        if (typeof j.USD === "number" && j.USD > 0) {
          setRates({ NGN: 1, USD: j.USD, GBP: j.GBP > 0 ? j.GBP : 0.00052 });
        }
      })
      .catch(() => undefined);
  }, []);

  const subtotalNGN = items.reduce((s, i) => s + i.priceNGN * i.quantity, 0);
  const disc = couponResult?.valid ? couponResult.discountNGN : 0;
  const ship = shippingCostNGN ?? 0;
  const ptsValue = pointsValueNGN;
  const totalNGN = Math.max(0, subtotalNGN + ship - disc);
  const remainingNGN = Math.max(0, totalNGN - ptsValue);
  const extrasNGN = ship - disc;
  const subtotalShopper = items.reduce((s, i) => s + cartLineAmountInCurrency(i, currency, rates), 0);
  const remainingShopper = Math.max(
    0,
    subtotalShopper + extrasAmountInCurrency(extrasNGN, currency, rates) - extrasAmountInCurrency(ptsValue, currency, rates),
  );

  const fmtLine = (item: CartItem) => formatPrice(cartLineAmountInCurrency(item, currency, rates), currency);
  const fmtExtra = (n: number) => formatPrice(extrasAmountInCurrency(n, currency, rates), currency);

  return (
    <div className="rounded-sm border border-border bg-cream p-5">
      <h3 className="font-display text-lg text-choc">Order summary</h3>
      <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
        {step > 1 ? (
          <li className="text-sm text-charcoal-mid">{items.length} items</li>
        ) : (
          items.map((i) => (
            <li key={i.id} className="flex gap-3 text-sm">
              <Image src={i.imageUrl} alt={i.productName} width={48} height={60} className="rounded-sm object-cover" />
              <div className="flex-1">
                <p className="font-medium text-charcoal">{i.productName}</p>
                <p className="text-charcoal-mid">
                  {i.sizeMode === "CUSTOM" ? "Made to measure" : i.size} ×{i.quantity}
                </p>
              </div>
              <p>{fmtLine(i)}</p>
            </li>
          ))
        )}
      </ul>
      <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-charcoal-mid">Subtotal</span>
          <span>{formatPrice(subtotalShopper, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-charcoal-mid">Shipping</span>
          <span>{shippingCostNGN == null ? "—" : ship === 0 ? <span className="text-gold">Free</span> : fmtExtra(ship)}</span>
        </div>
        {disc > 0 && (
          <div className="flex justify-between text-success">
            <span>Coupon</span>
            <span>−{fmtExtra(disc)}</span>
          </div>
        )}
        {ptsValue > 0 && (
          <div className="flex justify-between text-gold">
            <span>
              Points ({pointsToRedeem.toLocaleString()} Prudent Points × ₦{pointRate})
            </span>
            <span>−{fmtExtra(ptsValue)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 font-display text-lg text-choc">
          <span>{ptsValue > 0 ? "To pay" : "Total"}</span>
          <span>{formatPrice(remainingShopper, currency)}</span>
        </div>
        {ptsValue > 0 && remainingNGN > 0.01 && ship > 0 ? (
          <p className="pt-1 text-[11px] text-charcoal-mid">Shipping is paid in cash — points cover the garment only.</p>
        ) : null}
      </div>
      {step < 3 && (
        <p className="mt-3 font-label text-[11px] text-gold">
          Earn ~{Math.floor(Math.max(0, subtotalNGN - disc) / 100)} pts with this order
        </p>
      )}
    </div>
  );
}
