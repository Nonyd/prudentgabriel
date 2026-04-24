"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ShopCurrency } from "@/lib/currency";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { StripePayBlock } from "@/components/checkout/StripePayBlock";
import type { AddressInput } from "@/validations/order";

type Gateway = "PAYSTACK" | "FLUTTERWAVE" | "STRIPE" | "MONNIFY";

interface ShipOpt {
  zoneId: string;
  zoneName: string;
  costNGN: number;
  isFree: boolean;
  estimatedDays: string;
}

export function CheckoutClient() {
  const { data: session, status } = useSession();
  const currency = useCurrencyStore((s) => s.currency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);

  const [step, setStep] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<{
    valid: boolean;
    discountNGN: number;
    isFreeShipping: boolean;
    error?: string;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [notes, setNotes] = useState("");

  const [savedAddresses, setSavedAddresses] = useState<
    { id: string; firstName: string; lastName: string; street: string; city: string; state: string; country: string; phone: string }[]
  >([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addr, setAddr] = useState<Partial<AddressInput>>({
    country: "NG",
  });

  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [shippingOpts, setShippingOpts] = useState<ShipOpt[]>([]);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [shipLoading, setShipLoading] = useState(false);

  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{ id: string; number: string; guestEmail?: string | null } | null>(
    null,
  );
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePk, setStripePk] = useState("");

  const subtotalNGN = useMemo(() => items.reduce((s, i) => s + i.priceNGN * i.quantity, 0), [items]);
  const emailForCoupon = (session?.user?.email ?? guestEmail).trim();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    void fetch("/api/account/addresses")
      .then((r) => r.json())
      .then((j: { addresses?: typeof savedAddresses }) => setSavedAddresses(j.addresses ?? []))
      .catch(() => {});
  }, [status, session?.user?.id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- shipping quote; avoid loop on items reference
  useEffect(() => {
    if (step !== 2) return;
    if (!addr.city || !addr.state || !addr.country) return;
    setShipLoading(true);
    const isFree = couponResult?.valid && couponResult.isFreeShipping;
    void fetch("/api/shipping/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: { city: addr.city, state: addr.state, country: addr.country },
        subtotalNGN,
        totalWeightKg: Math.max(0.5, items.reduce((s, i) => s + i.quantity, 0) * 0.5),
        isFreeShippingCoupon: isFree,
      }),
    })
      .then((r) => r.json())
      .then((j: { options?: ShipOpt[] }) => {
        const opts = j.options ?? [];
        setShippingOpts(opts);
        setZoneId((prev) => {
          if (opts.some((o) => o.zoneId === prev)) return prev;
          return opts[0]?.zoneId ?? null;
        });
      })
      .finally(() => setShipLoading(false));
  }, [step, addr.city, addr.state, addr.country, subtotalNGN, items.length, couponResult?.valid, couponResult?.isFreeShipping]);

  async function applyCoupon() {
    if (!couponCode.trim() || !emailForCoupon) {
      toast.error("Enter email (guest) and coupon code");
      return;
    }
    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode,
          subtotalNGN,
          email: emailForCoupon,
          cartLines: items.map((i) => ({
            priceNGN: i.priceNGN,
            quantity: i.quantity,
            category: i.category,
          })),
        }),
      });
      const data = (await res.json()) as {
        valid: boolean;
        discountNGN?: number;
        isFreeShipping?: boolean;
        error?: string;
      };
      setCouponResult({
        valid: data.valid,
        discountNGN: data.discountNGN ?? 0,
        isFreeShipping: data.isFreeShipping ?? false,
        error: data.error,
      });
      if (!data.valid) toast.error(data.error ?? "Invalid");
      else toast.success("Coupon applied");
    } catch {
      toast.error("Could not validate coupon");
    } finally {
      setCouponLoading(false);
    }
  }

  const selectedShip = shippingOpts.find((z) => z.zoneId === zoneId);
  const shipCost = selectedShip?.costNGN ?? null;

  function buildAddressPayload(): AddressInput | undefined {
    if (addressId) return undefined;
    if (!addr.firstName || !addr.lastName || !addr.phone || !addr.line1 || !addr.city || !addr.state || !addr.country) {
      return undefined;
    }
    return {
      firstName: addr.firstName,
      lastName: addr.lastName,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      saveAddress: Boolean(addr.saveAddress),
    };
  }

  async function submitOrder() {
    if (!gateway) {
      toast.error("Choose a payment method");
      return;
    }
    if (!zoneId) {
      toast.error("Choose shipping");
      return;
    }
    if (status === "unauthenticated") {
      if (!guestEmail.trim()) {
        toast.error("Email required");
        return;
      }
    }
    const addressPayload = addressId ? undefined : buildAddressPayload();
    if (!addressId && !addressPayload) {
      toast.error("Complete your address");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        addressId: addressId ?? undefined,
        address: addressPayload,
        shippingZoneId: zoneId,
        notes: notes || undefined,
        isGift,
        giftMessage: isGift ? giftMessage || undefined : undefined,
        currency,
        gateway,
        couponCode: couponResult?.valid ? couponCode : undefined,
        pointsToRedeem: session?.user ? pointsToRedeem : 0,
        guestEmail: status === "unauthenticated" ? guestEmail : undefined,
        guestName: status === "unauthenticated" ? guestName : undefined,
        guestPhone: status === "unauthenticated" ? guestPhone : undefined,
      };

      if (status === "unauthenticated") {
        body.cartLines = items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          size: i.size,
          color: i.color,
          colorHex: i.colorHex,
          colorId: i.colorId,
        }));
      }

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not create order");
        setSubmitting(false);
        return;
      }

      const orderId = data.orderId as string;
      const orderNumber = data.orderNumber as string;
      setCreatedOrder({ id: orderId, number: orderNumber, guestEmail: guestEmail || session?.user?.email });

      if (gateway === "PAYSTACK") {
        const pr = await fetch("/api/payment/paystack/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, guestEmail: guestEmail || undefined }),
        });
        const p = await pr.json();
        if (!pr.ok) throw new Error(p.error);
        window.location.href = p.authorizationUrl as string;
        return;
      }
      if (gateway === "FLUTTERWAVE") {
        const pr = await fetch("/api/payment/flutterwave/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, currency, guestEmail: guestEmail || undefined }),
        });
        const p = await pr.json();
        if (!pr.ok) throw new Error(p.error);
        window.location.href = p.paymentLink as string;
        return;
      }
      if (gateway === "MONNIFY") {
        const pr = await fetch("/api/payment/monnify/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, guestEmail: guestEmail || undefined }),
        });
        const p = await pr.json();
        if (!pr.ok) throw new Error(p.error);
        window.location.href = p.checkoutUrl as string;
        return;
      }
      if (gateway === "STRIPE") {
        const pr = await fetch("/api/payment/stripe/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            currency: currency === "NGN" ? "USD" : currency,
            guestEmail: guestEmail || undefined,
          }),
        });
        const p = await pr.json();
        if (!pr.ok) throw new Error(p.error);
        setStripeClientSecret(p.clientSecret as string);
        setStripePk((p.publishableKey as string) ?? "");
        useCartStore.getState().clearCart();
        setSubmitting(false);
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    }
    setSubmitting(false);
  }

  const stripeReturnUrl = useMemo(() => {
    if (!createdOrder?.number) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const q = guestEmail ? `&email=${encodeURIComponent(guestEmail)}` : "";
    return `${origin}/checkout/success?order=${encodeURIComponent(createdOrder.number)}${q}`;
  }, [createdOrder?.number, guestEmail]);

  if (!items.length) {
    return (
      <div className="py-20 text-center">
        <p className="text-charcoal-mid">Your bag is empty.</p>
        <Link href="/shop" className="mt-4 inline-block text-wine underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-site flex-col gap-10 px-4 py-10 lg:flex-row lg:items-start">
      <div className="flex-1">
        <div className="mb-8 flex items-center justify-between gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={clsx(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-medium",
                  step > s ? "border-wine bg-wine text-ivory" : step === s ? "border-gold text-wine" : "border-border text-charcoal-mid",
                )}
              >
                {step > s ? "✓" : s}
              </div>
              {s < 3 && <div className={clsx("h-0.5 flex-1", step > s ? "bg-wine" : "bg-border")} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="font-display text-2xl text-wine">Your bag</h2>
            {items.map((i) => (
              <div key={i.id} className="flex gap-4 border-b border-border pb-4">
                <Image src={i.imageUrl} alt="" width={64} height={80} className="rounded-sm object-cover" />
                <div className="flex-1">
                  <p className="font-medium">{i.productName}</p>
                  <p className="text-sm text-charcoal-mid">
                    {i.size}
                    {i.color ? ` · ${i.color}` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded border border-border px-2"
                      onClick={() => {
                        const next = Math.max(1, i.quantity - 1);
                        updateQty(i.id, next);
                      }}
                    >
                      −
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      type="button"
                      className="rounded border border-border px-2"
                      onClick={() => {
                        const max = i.stock ?? 999;
                        const next = Math.min(max, i.quantity + 1);
                        updateQty(i.id, next);
                      }}
                    >
                      +
                    </button>
                    <button type="button" className="ml-auto text-charcoal-light hover:text-wine" onClick={() => removeItem(i.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                className="flex-1 border-b border-border bg-transparent py-2 uppercase outline-none focus:border-wine"
                placeholder="Coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              />
              <button type="button" onClick={applyCoupon} disabled={couponLoading} className="rounded-sm bg-charcoal px-4 py-2 text-sm text-ivory">
                {couponLoading ? "…" : "Apply"}
              </button>
            </div>
            {couponResult && !couponResult.valid && <p className="text-sm text-error">{couponResult.error}</p>}
            {couponResult?.valid && (
              <p className="text-sm text-success">
                {couponResult.isFreeShipping ? "Free shipping applied" : `₦${couponResult.discountNGN.toLocaleString()} off`}
              </p>
            )}
            {session?.user && (session.user.pointsBalance ?? 0) > 0 && (
              <label className="block text-sm">
                <span>Redeem points (max {Math.min(session.user.pointsBalance ?? 0, Math.floor(subtotalNGN))})</span>
                <input
                  type="number"
                  min={0}
                  max={Math.min(session.user.pointsBalance ?? 0, Math.floor(subtotalNGN))}
                  className="mt-1 w-full border-b border-border bg-transparent py-1"
                  value={pointsToRedeem}
                  onChange={(e) => setPointsToRedeem(Number(e.target.value) || 0)}
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
              This is a gift
            </label>
            {isGift && (
              <textarea
                className="w-full rounded-sm border border-border bg-ivory p-3 text-sm"
                maxLength={200}
                placeholder="Gift message"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
              />
            )}
            <button type="button" onClick={() => setStep(2)} className="w-full rounded-sm bg-wine py-3 text-ivory">
              Continue to delivery
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl text-wine">Delivery</h2>
            {status === "unauthenticated" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="border-b border-border bg-transparent py-2" placeholder="Email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
                <input className="border-b border-border bg-transparent py-2" placeholder="Full name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                <input className="border-b border-border bg-transparent py-2 sm:col-span-2" placeholder="Phone" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
              </div>
            )}
            {savedAddresses.length > 0 && (
              <div className="space-y-2">
                {savedAddresses.map((a) => (
                  <label key={a.id} className="flex cursor-pointer gap-2 rounded-sm border border-border p-3">
                    <input type="radio" name="addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                    <span className="text-sm">
                      {a.firstName} {a.lastName} — {a.street}, {a.city}
                    </span>
                  </label>
                ))}
                <button type="button" className="text-sm text-wine" onClick={() => setAddressId(null)}>
                  Use a different address
                </button>
              </div>
            )}
            {!addressId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <input placeholder="First name" className="border-b bg-transparent py-2" onChange={(e) => setAddr((p) => ({ ...p, firstName: e.target.value }))} />
                <input placeholder="Last name" className="border-b bg-transparent py-2" onChange={(e) => setAddr((p) => ({ ...p, lastName: e.target.value }))} />
                <input placeholder="Phone" className="border-b bg-transparent py-2 sm:col-span-2" onChange={(e) => setAddr((p) => ({ ...p, phone: e.target.value }))} />
                <input placeholder="Address line 1" className="border-b bg-transparent py-2 sm:col-span-2" onChange={(e) => setAddr((p) => ({ ...p, line1: e.target.value }))} />
                <input placeholder="City" className="border-b bg-transparent py-2" onChange={(e) => setAddr((p) => ({ ...p, city: e.target.value }))} />
                <input placeholder="State" className="border-b bg-transparent py-2" onChange={(e) => setAddr((p) => ({ ...p, state: e.target.value }))} />
                <input placeholder="Country (ISO)" className="border-b bg-transparent py-2" value={addr.country} onChange={(e) => setAddr((p) => ({ ...p, country: e.target.value.toUpperCase() }))} />
                {session?.user && (
                  <label className="flex items-center gap-2 sm:col-span-2 text-sm">
                    <input type="checkbox" onChange={(e) => setAddr((p) => ({ ...p, saveAddress: e.target.checked }))} />
                    Save this address
                  </label>
                )}
              </div>
            )}
            <div>
              <p className="mb-2 font-medium">Shipping method</p>
              {shipLoading ? <p className="text-sm text-charcoal-mid">Loading…</p> : null}
              {shippingOpts.map((z) => (
                <label key={z.zoneId} className="mb-2 flex cursor-pointer gap-2 rounded-sm border border-border p-3">
                  <input type="radio" name="ship" checked={zoneId === z.zoneId} onChange={() => setZoneId(z.zoneId)} />
                  <span className="text-sm">
                    {z.zoneName} — {z.isFree ? <span className="text-gold">FREE</span> : `₦${z.costNGN.toLocaleString()}`} · {z.estimatedDays}
                  </span>
                </label>
              ))}
            </div>
            <textarea className="w-full rounded-sm border border-border p-3 text-sm" placeholder="Order notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex gap-3">
              <button type="button" className="flex-1 border border-border py-2" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="flex-1 bg-wine py-2 text-ivory" onClick={() => setStep(3)}>
                Continue to payment
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl text-wine">Payment</h2>
            <div className="flex flex-wrap gap-2">
              {(["NGN", "USD", "GBP"] as ShopCurrency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={clsx("rounded-full px-4 py-1 text-sm", currency === c ? "bg-wine text-ivory" : "border border-border")}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {currency === "NGN" && (
                <label className="flex gap-2 rounded-sm border p-3">
                  <input type="radio" name="gw" checked={gateway === "PAYSTACK"} onChange={() => setGateway("PAYSTACK")} />
                  Paystack
                </label>
              )}
              <label className="flex gap-2 rounded-sm border p-3">
                <input type="radio" name="gw" checked={gateway === "FLUTTERWAVE"} onChange={() => setGateway("FLUTTERWAVE")} />
                Flutterwave
              </label>
              {(currency === "USD" || currency === "GBP") && (
                <label className="flex gap-2 rounded-sm border p-3">
                  <input type="radio" name="gw" checked={gateway === "STRIPE"} onChange={() => setGateway("STRIPE")} />
                  Stripe (cards)
                </label>
              )}
              {currency === "NGN" && (
                <label className="flex gap-2 rounded-sm border p-3">
                  <input type="radio" name="gw" checked={gateway === "MONNIFY"} onChange={() => setGateway("MONNIFY")} />
                  Monnify
                </label>
              )}
            </div>
            {!stripeClientSecret && (
              <button type="button" disabled={submitting || !gateway} onClick={submitOrder} className="w-full bg-wine py-3 text-ivory disabled:opacity-50">
                {submitting ? "Please wait…" : "Place order & pay"}
              </button>
            )}
            {stripeClientSecret && stripePk && createdOrder && stripeReturnUrl && (
              <StripePayBlock clientSecret={stripeClientSecret} publishableKey={stripePk} returnUrl={stripeReturnUrl} />
            )}
            <button type="button" className="text-sm text-charcoal-mid underline" onClick={() => setStep(2)}>
              Back
            </button>
          </div>
        )}
      </div>

      <aside className="w-full shrink-0 lg:w-[360px] lg:sticky lg:top-24">
        <OrderSummary
          items={items}
          couponResult={couponResult}
          pointsToRedeem={pointsToRedeem}
          shippingCostNGN={shipCost}
          currency={currency}
          step={step}
        />
      </aside>
    </div>
  );
}
