"use client";

import Image from "next/image";
import type { CartItem } from "@/store/cartStore";
import { formatPrice, type ExchangeRatesNGN, type ShopCurrency } from "@/lib/currency";
import { cartLineAmountInCurrency, extrasAmountInCurrency } from "@/lib/pricing";
import { useEffect, useState } from "react";
import { useMadeThenShippedCopy } from "@/components/layout/ProductionTimeContext";

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
  shippingIsFree,
  shippingQuoted,
  currency,
  step,
  pointRate,
}: {
  items: CartItem[];
  couponResult: CouponResult | null;
  pointsToRedeem: number;
  pointsValueNGN: number;
  shippingCostNGN: number | null;
  shippingIsFree?: boolean;
  shippingQuoted?: boolean;
  currency: ShopCurrency;
  step: number;
  pointRate: number;
}) {
  const madeCopy = useMadeThenShippedCopy();
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
    <div className="glass-2 glass-panel p-6">
      <h2 className="font-display text-xl text-choc">Order summary</h2>
      <ul className="mt-5 max-h-64 space-y-4 overflow-y-auto">
        {items.map((i) => (
          <li key={i.id} className="flex gap-3 text-sm">
            <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-ivory-dark">
              {i.imageUrl ? (
                <Image src={i.imageUrl} alt="" fill className="object-cover" sizes="48px" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm text-charcoal">{i.productName}</p>
              <p className="mt-0.5 text-charcoal-mid">
                {[i.optionLabel, i.sizeMode === "CUSTOM" ? "Made to measure" : i.size].filter(Boolean).join(", ")}
                {" · "}
                {i.quantity}
              </p>
            </div>
            <p className="shrink-0 tabular-nums">{fmtLine(i)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
        <div className="flex justify-between">
          <span className="text-charcoal-mid">Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotalShopper, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-charcoal-mid">Shipping</span>
          <span className="tabular-nums">
            {shippingCostNGN == null
              ? "—"
              : shippingQuoted
                ? "Quoted after packing"
                : shippingIsFree || ship === 0
                  ? <span className="text-gold">Free</span>
                  : fmtExtra(ship)}
          </span>
        </div>
        {disc > 0 && (
          <div className="flex justify-between text-success">
            <span>Coupon</span>
            <span className="tabular-nums">−{fmtExtra(disc)}</span>
          </div>
        )}
        {ptsValue > 0 && (
          <div className="flex justify-between text-gold">
            <span>
              Points ({pointsToRedeem.toLocaleString()} Prudent Points × ₦{pointRate})
            </span>
            <span className="tabular-nums">−{fmtExtra(ptsValue)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-3 font-display text-lg text-choc">
          <span>{ptsValue > 0 ? "To pay" : "Total"}</span>
          <span className="tabular-nums">{formatPrice(remainingShopper, currency)}</span>
        </div>
        {ptsValue > 0 && remainingNGN > 0.01 && ship > 0 ? (
          <p className="pt-1 text-[11px] text-charcoal-mid">Shipping is paid in cash. Points cover the garment only.</p>
        ) : null}
      </div>
      <p className="mt-4 font-body text-[12px] leading-5 text-charcoal-mid">{madeCopy}</p>
      {step < 3 && (
        <p className="mt-3 font-label text-[11px] text-gold">
          Earn ~{Math.floor(Math.max(0, subtotalNGN - disc) / 100)} pts with this order
        </p>
      )}
    </div>
  );
}
