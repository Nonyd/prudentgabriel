"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useCartStore } from "@/store/cartStore";
import { useBagActions } from "@/hooks/useBagActions";
import { BagQtyButtons } from "@/components/cart/BagLineControls";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ShopCurrency } from "@/lib/currency";
import type { AddressInput } from "@/validations/order";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { StripePayBlock } from "@/components/checkout/StripePayBlock";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { PrudentPointsPayOption } from "@/components/checkout/PrudentPointsPayOption";
import type { PaymentGatewayType } from "@/lib/payments/index";
import { formatPrice } from "@/lib/currency";
import { extrasAmountInCurrency, cartLineAmountInCurrency } from "@/lib/pricing";
import { clampRedemption } from "@/lib/points-value";
import { readJsonBody, jsonErrorMessage } from "@/lib/http/read-json";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NIGERIA_STATES } from "@/lib/geo/nigeria-states";
import { COUNTRIES } from "@/lib/geo/countries";
import { CUSTOM_RETURNS_COPY } from "@/lib/custom-size";
import { readHeldAttribution } from "@/lib/analytics/attribution";
import { focusField } from "@/lib/form-errors";

interface ShipOpt {
  zoneId: string;
  zoneName: string;
  costNGN: number;
  isFree: boolean;
  estimatedDays: string;
  kind?: string;
  requiresConsent?: boolean;
  requiresAddress?: boolean;
  description?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEPS = [
  { n: 1, label: "Bag" },
  { n: 2, label: "Delivery" },
  { n: 3, label: "Payment" },
] as const;

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-error" role="alert">
      {message}
    </p>
  );
}

const fieldSelectClass =
  "w-full min-h-[44px] border-0 border-b border-border bg-transparent py-2 font-body text-base text-charcoal outline-none focus:border-b-2 focus:border-choc";

function CheckoutEmpty() {
  const router = useRouter();
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--storefront-chrome-offset,8rem))] max-w-site items-center justify-center px-4 py-16 lg:px-10">
      <div className="glass-opaque w-full max-w-lg px-8 py-16 text-center sm:px-12">
        <svg
          className="mx-auto mb-6 h-14 w-14 text-choc"
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M12 20h40l-4 32H16L12 20z" />
          <path d="M20 20V14a12 12 0 0124 0v6" />
        </svg>
        <h1 className="font-display text-3xl italic leading-[1.15] text-charcoal">Your bag is empty</h1>
        <p className="mx-auto mt-3 max-w-[36ch] font-body text-base leading-6 text-charcoal-mid">
          Add a piece, then come back here to pay.
        </p>
        <Button type="button" className="mt-8" onClick={() => router.push("/rtw")}>
          Shop ready-to-wear
        </Button>
      </div>
    </div>
  );
}

export function CheckoutClient() {
  const { data: session, status } = useSession();
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const items = useCartStore((s) => s.items);
  const hasCustom = items.some((i) => i.sizeMode === "CUSTOM");
  const customNotReturnable = items.some((i) => i.sizeMode === "CUSTOM" && i.customReturnable !== true);
  const { changeQty, removeFromBag } = useBagActions();

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
  const [livePoints, setLivePoints] = useState<number | null>(null);
  const [pointRate, setPointRate] = useState(1);
  const [minRedemption, setMinRedemption] = useState(100);
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [notes, setNotes] = useState("");

  const [savedAddresses, setSavedAddresses] = useState<
    { id: string; firstName: string; lastName: string; street: string; city: string; state: string; country: string; phone: string }[]
  >([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addr, setAddr] = useState<Partial<AddressInput>>({
    country: "NG",
    firstName: "",
    lastName: "",
    phone: "",
    line1: "",
    city: "",
    state: "",
    postalCode: "",
  });

  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [shippingOpts, setShippingOpts] = useState<ShipOpt[]>([]);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [shipLoading, setShipLoading] = useState(false);
  const [quoteConsent, setQuoteConsent] = useState("");
  const [dduDisclosure, setDduDisclosure] = useState("");
  const [shippingConsent, setShippingConsent] = useState(false);
  const [customReturnConsent, setCustomReturnConsent] = useState(false);
  const [preferredContact, setPreferredContact] = useState<"WHATSAPP" | "CALL" | "EMAIL">("WHATSAPP");
  const paymentRef = useMemo(
    () => `PA-ORDER-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    [],
  );
  const [gateway, setGateway] = useState<PaymentGatewayType | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{ id: string; number: string; guestEmail?: string | null } | null>(
    null,
  );
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePk, setStripePk] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createdOrderRef = useRef(createdOrder);
  createdOrderRef.current = createdOrder;
  const guestEmailTouched = useRef(false);
  const checkoutSessionId = useRef<string | null>(null);

  const subtotalNGN = useMemo(() => items.reduce((s, i) => s + i.priceNGN * i.quantity, 0), [items]);
  const emailForCoupon = (session?.user?.email ?? guestEmail).trim();
  const isGuest = status === "unauthenticated";

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    void fetch("/api/account/addresses")
      .then((r) => r.json())
      .then((j: { addresses?: typeof savedAddresses }) => setSavedAddresses(j.addresses ?? []))
      .catch(() => {});
  }, [status, session?.user?.id]);

  useEffect(() => {
    void fetch("/api/loyalty/config")
      .then((r) => r.json())
      .then((j: { rateNGN?: number; minRedemption?: number }) => {
        if (typeof j.rateNGN === "number" && j.rateNGN > 0) setPointRate(j.rateNGN);
        if (typeof j.minRedemption === "number" && j.minRedemption >= 0) setMinRedemption(j.minRedemption);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      setLivePoints(null);
      return;
    }
    void fetch("/api/account/wallet?limit=1")
      .then((r) => r.json())
      .then((j: { pointsBalance?: number }) => {
        if (typeof j.pointsBalance === "number") setLivePoints(j.pointsBalance);
      })
      .catch(() => undefined);
  }, [status]);

  useEffect(() => {
    if (step !== 2) return;
    if (!addr.country) return;
    if (addr.country === "NG" && !addr.state) return;
    setShipLoading(true);
    const isFree = couponResult?.valid && couponResult.isFreeShipping;
    void fetch("/api/shipping/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: { city: addr.city || "", state: addr.state || "", country: addr.country },
        subtotalNGN,
        isFreeShippingCoupon: isFree,
        lines: items.map((i) => ({ quantity: i.quantity })),
      }),
    })
      .then((r) => r.json())
      .then((j: { options?: ShipOpt[]; quoteConsent?: string }) => {
        const opts = j.options ?? [];
        setShippingOpts(opts);
        if (j.quoteConsent) setQuoteConsent(j.quoteConsent);
        setZoneId((prev) => {
          if (opts.some((o) => o.zoneId === prev)) return prev;
          const delivery = opts.find((o) => o.kind !== "PICKUP");
          return delivery?.zoneId ?? opts[0]?.zoneId ?? null;
        });
      })
      .finally(() => setShipLoading(false));
  }, [step, addr.city, addr.state, addr.country, subtotalNGN, items, couponResult?.valid, couponResult?.isFreeShipping]);

  useEffect(() => {
    setPreferredContact(addr.country === "NG" || !addr.country ? "WHATSAPP" : "EMAIL");
  }, [addr.country]);

  useEffect(() => {
    if (!guestEmailTouched.current) return;
    setCouponResult(null);
  }, [guestEmail]);

  function setFieldError(key: string, message: string) {
    setErrors((prev) => ({ ...prev, [key]: message }));
  }

  function clearFieldError(key: string) {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateGuestEmail(): boolean {
    if (!isGuest) return true;
    if (!guestEmail.trim()) {
      setFieldError("guestEmail", "Email is required");
      return false;
    }
    if (!EMAIL_RE.test(guestEmail.trim())) {
      setFieldError("guestEmail", "Enter a valid email address");
      return false;
    }
    clearFieldError("guestEmail");
    return true;
  }

  function validateDelivery(): string | null {
    const next: Record<string, string> = {};
    if (isGuest) {
      if (!guestEmail.trim()) next.guestEmail = "Email is required";
      else if (!EMAIL_RE.test(guestEmail.trim())) next.guestEmail = "Enter a valid email address";
      if (!guestName.trim()) next.guestName = "Full name is required";
      if (!guestPhone.trim() || guestPhone.replace(/\D/g, "").length < 7) {
        next.guestPhone = "Enter a phone number we can reach you on";
      }
    }
    if (!addressId) {
      if (!addr.firstName?.trim()) next.firstName = "First name is required";
      if (!addr.lastName?.trim()) next.lastName = "Last name is required";
      if (!addr.phone?.trim() || addr.phone.replace(/\D/g, "").length < 7) {
        next.phone = "Enter a phone number";
      }
      if (!isPickup) {
        if (!addr.line1?.trim() || addr.line1.trim().length < 3) next.line1 = "Street address is required";
        if (!addr.city?.trim()) next.city = "City is required";
      }
      if (!addr.state?.trim()) next.state = "State is required";
      if (!addr.country || addr.country.length !== 2) next.country = "Choose a country";
    }
    if (!zoneId) next.shipping = "Choose a shipping method";
    if (needsConsent && !shippingConsent) next.consent = "Please confirm you understand shipping will be quoted separately";
    if (hasCustom && customNotReturnable && !customReturnConsent) {
      next.customReturn = "Please confirm you understand custom pieces cannot be returned";
    }
    setErrors((prev) => ({ ...prev, ...next }));
    const order = [
      "guestEmail",
      "guestName",
      "guestPhone",
      "firstName",
      "lastName",
      "phone",
      "line1",
      "city",
      "state",
      "country",
      "shipping",
      "consent",
      "customReturn",
    ];
    return order.find((k) => next[k]) ?? null;
  }

  async function applyCoupon() {
    if (!couponCode.trim()) {
      setCouponResult({
        valid: false,
        discountNGN: 0,
        isFreeShipping: false,
        error: "Enter a coupon code",
      });
      focusField("coupon-code");
      return;
    }
    if (!emailForCoupon) {
      setCouponResult({
        valid: false,
        discountNGN: 0,
        isFreeShipping: false,
        error: "Enter your email above to apply a coupon. The code is not invalid — we need an email first.",
      });
      setFieldError("guestEmail", "Email is required to apply a coupon");
      focusField("guest-email");
      return;
    }
    if (isGuest && !EMAIL_RE.test(emailForCoupon)) {
      setCouponResult({
        valid: false,
        discountNGN: 0,
        isFreeShipping: false,
        error: "Enter a valid email above to apply a coupon.",
      });
      setFieldError("guestEmail", "Enter a valid email address");
      focusField("guest-email");
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
      if (!data.valid) toast.error(data.error ?? "This coupon could not be applied");
      else {
        toast.success("Coupon applied");
        void persistCheckoutSession(1);
      }
    } catch {
      toast.error("Could not validate coupon");
    } finally {
      setCouponLoading(false);
    }
  }

  const selectedShip = shippingOpts.find((z) => z.zoneId === zoneId);
  const isPickup = selectedShip?.kind === "PICKUP" || zoneId?.startsWith("pickup:");
  const needsConsent = Boolean(selectedShip?.requiresConsent);
  const isInternational = (addr.country ?? "NG") !== "NG";

  useEffect(() => {
    void fetch("/api/shipping/calculate")
      .then((r) => r.json())
      .then((j: { quoteConsent?: string; dduDisclosure?: string }) => {
        if (j.quoteConsent) setQuoteConsent(j.quoteConsent);
        if (j.dduDisclosure) setDduDisclosure(j.dduDisclosure);
      })
      .catch(() => {});
  }, []);
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

  async function persistCheckoutSession(furthestStep: number) {
    const email = (session?.user?.email ?? guestEmail).trim();
    if (!email || !EMAIL_RE.test(email) || items.length === 0) return;
    try {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: checkoutSessionId.current,
          email,
          currency,
          furthestStep,
          cartSnapshot: {
            lines: items,
            subtotalNGN,
          },
          attribution: readHeldAttribution() ?? undefined,
        }),
      });
      const json = (await res.json()) as { id?: string };
      if (json.id) checkoutSessionId.current = json.id;
    } catch {
      /* recovery is best-effort */
    }
  }

  function goToDelivery() {
    if (isGuest && !validateGuestEmail()) {
      focusField("guest-email");
      return;
    }
    void persistCheckoutSession(2);
    setStep(2);
  }

  function goToPayment() {
    const first = validateDelivery();
    if (first) {
      const idMap: Record<string, string> = {
        guestEmail: "guest-email",
        guestName: "guest-name",
        guestPhone: "guest-phone",
        firstName: "addr-first-name",
        lastName: "addr-last-name",
        phone: "addr-phone",
        line1: "addr-line1",
        city: "addr-city",
        state: "addr-state",
        country: "addr-country",
        shipping: "shipping-method",
      };
      focusField(idMap[first] ?? idMap.shipping);
      toast.error("Please complete the highlighted fields");
      return;
    }
    void persistCheckoutSession(3);
    setStep(3);
  }

  async function submitOrder() {
    const first = validateDelivery();
    if (first) {
      setStep(2);
      toast.error("Please complete delivery details first");
      return;
    }
    if (!gateway && payable > 0.01) {
      setFieldError("gateway", "Choose a payment method");
      focusField("payment-method");
      toast.error("Choose a payment method");
      return;
    }
    clearFieldError("gateway");
    // Create the order first. Receipt upload only looks up a row that already exists.

    const addressPayload = isPickup ? undefined : addressId ? undefined : buildAddressPayload();
    if (!isPickup && !addressId && !addressPayload) {
      setStep(2);
      toast.error("Complete your address");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        addressId: isPickup ? undefined : addressId ?? undefined,
        address: isPickup ? undefined : addressPayload,
        pickupContact: isPickup
          ? {
              firstName: addr.firstName,
              lastName: addr.lastName,
              phone: addr.phone,
              country: addr.country ?? "NG",
              state: addr.state ?? "Lagos",
              city: addr.city ?? "Lagos",
            }
          : undefined,
        shippingOptionId: zoneId,
        shippingConsent: needsConsent ? shippingConsent : undefined,
        shippingConsentText: needsConsent ? quoteConsent : undefined,
        preferredContactMethod: needsConsent ? preferredContact : undefined,
        notes: notes || undefined,
        isGift,
        giftMessage: isGift ? giftMessage || undefined : undefined,
        currency,
        gateway: payable > 0.01 ? gateway : undefined,
        couponCode: couponResult?.valid ? couponCode : undefined,
        pointsToRedeem: session?.user ? pointsToRedeem : 0,
        guestEmail: isGuest ? guestEmail : undefined,
        guestName: isGuest ? guestName : undefined,
        guestPhone: isGuest ? guestPhone : undefined,
        paymentRef,
        customReturnConsent: hasCustom && customNotReturnable ? customReturnConsent : undefined,
        attribution: readHeldAttribution() ?? undefined,
      };

      if (isGuest) {
        body.cartLines = items.map((i) => ({
          productId: i.productId,
          variantId: i.sizeMode === "CUSTOM" ? null : i.variantId,
          quantity: i.quantity,
          size: i.size,
          color: i.color,
          colorHex: i.colorHex,
          colorId: i.colorId,
          sizeMode: i.sizeMode ?? "STANDARD",
          optionId: i.optionId ?? null,
          measurements: i.measurements?.map((m) => ({
            key: m.key,
            value: m.typedValue,
            unit: m.typedUnit,
          })),
          typedUnit: i.typedUnit === "in" || i.typedUnit === "cm" ? i.typedUnit : undefined,
        }));
      }

      let orderId = createdOrder?.id;
      let orderNumber = createdOrder?.number;
      let paidWithPoints = false;
      let outstandingNGN: number | undefined;

      if (!orderId || !orderNumber) {
        const res = await fetch("/api/orders/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(jsonErrorMessage((data as { error?: unknown }).error, "Could not create order"));
          setSubmitting(false);
          return;
        }
        orderId = (data as { orderId: string }).orderId;
        orderNumber = (data as { orderNumber: string }).orderNumber;
        paidWithPoints = Boolean((data as { paidWithPoints?: boolean }).paidWithPoints);
        outstandingNGN =
          typeof (data as { outstandingNGN?: number }).outstandingNGN === "number"
            ? (data as { outstandingNGN: number }).outstandingNGN
            : undefined;
        setCreatedOrder({ id: orderId, number: orderNumber, guestEmail: guestEmail || session?.user?.email });
      }

      if (!orderId || !orderNumber) {
        toast.error("Could not create order");
        setSubmitting(false);
        return;
      }

      if (paidWithPoints || (typeof outstandingNGN === "number" && outstandingNGN <= 0.01)) {
        const q = guestEmail ? `&email=${encodeURIComponent(guestEmail)}` : "";
        window.location.href = `/checkout/success?order=${encodeURIComponent(orderNumber)}${q}`;
        return;
      }

      if (gateway === "BANK_TRANSFER") {
        if (!receiptUrl) {
          toast.success("Order placed. Upload your payment receipt to finish.");
          setSubmitting(false);
          return;
        }
        const bt = await fetch("/api/checkout/bank-transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            receiptUrl,
            guestEmail: guestEmail || undefined,
          }),
        });
        const btj = await readJsonBody(bt);
        if (!bt.ok) throw new Error(jsonErrorMessage(btj.error, "Could not submit receipt"));
        window.location.href = btj.redirectUrl as string;
        return;
      }

      if (gateway === "PAYSTACK") {
        const pr = await fetch("/api/payment/paystack/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, guestEmail: guestEmail || undefined }),
        });
        const p = await readJsonBody(pr);
        if (!pr.ok) throw new Error(jsonErrorMessage(p.error, "Could not start card payment"));
        window.location.href = p.authorizationUrl as string;
        return;
      }
      if (gateway === "FLUTTERWAVE") {
        const pr = await fetch("/api/payment/flutterwave/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, currency, guestEmail: guestEmail || undefined }),
        });
        const p = await readJsonBody(pr);
        if (!pr.ok) throw new Error(jsonErrorMessage(p.error, "Could not start payment"));
        window.location.href = p.paymentLink as string;
        return;
      }
      if (gateway === "MONNIFY") {
        const pr = await fetch("/api/payment/monnify/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, guestEmail: guestEmail || undefined }),
        });
        const p = await readJsonBody(pr);
        if (!pr.ok) throw new Error(jsonErrorMessage(p.error, "Could not start payment"));
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
        const p = await readJsonBody(pr);
        if (!pr.ok) throw new Error(jsonErrorMessage(p.error, "Could not start payment"));
        setStripeClientSecret(p.clientSecret as string);
        setStripePk((p.publishableKey as string) ?? "");
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

  const discNGN = couponResult?.valid ? couponResult.discountNGN : 0;
  const ship = shipCost ?? 0;
  const availablePoints = livePoints ?? session?.user?.pointsBalance ?? 0;
  const clampedPts = clampRedemption({
    requested: pointsToRedeem,
    availablePoints,
    subtotalNGN,
    discountNGN: discNGN,
    rateNGN: pointRate,
    minRedemption,
  });
  const pointsValueNGN = clampedPts.valueNGN;
  const payable = Math.max(0, subtotalNGN + ship - discNGN - pointsValueNGN);
  const extrasNGN = ship - discNGN;
  const payableShopper = Math.max(
    0,
    items.reduce((s, i) => s + cartLineAmountInCurrency(i, currency, rates), 0) +
      extrasAmountInCurrency(extrasNGN, currency, rates) -
      extrasAmountInCurrency(pointsValueNGN, currency, rates),
  );
  const maxPts = clampRedemption({
    requested: availablePoints,
    availablePoints,
    subtotalNGN,
    discountNGN: discNGN,
    rateNGN: pointRate,
    minRedemption: 0,
  }).points;

  if (!items.length) {
    return <CheckoutEmpty />;
  }

  return (
    <div className="mx-auto flex max-w-site flex-col gap-8 px-4 py-10 lg:flex-row lg:items-start lg:gap-12 lg:px-10">
      <div className="min-w-0 flex-1 glass-opaque px-5 py-8 lg:px-10 lg:py-10">
        <h1 className="font-display text-3xl text-choc sm:text-4xl">Checkout</h1>
        <nav aria-label="Checkout steps" className="mt-8 border-b border-border">
          <ol className="flex min-w-0 gap-6 sm:gap-8">
            {STEPS.map((s) => {
              const done = step > s.n;
              const current = step === s.n;
              const canGo = s.n < step;
              return (
                <li key={s.n}>
                  <button
                    type="button"
                    disabled={!canGo}
                    onClick={() => {
                      if (canGo) setStep(s.n);
                    }}
                    className={clsx(
                      "-mb-px min-h-11 rounded-none border-b-2 pb-3 text-left font-display text-lg leading-none sm:text-xl",
                      current
                        ? "border-choc text-choc"
                        : done
                          ? "border-transparent text-charcoal hover:text-choc"
                          : "cursor-default border-transparent text-charcoal-light",
                    )}
                    aria-current={current ? "step" : undefined}
                  >
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {step === 1 && (
          <div className="space-y-8 pt-8">
            <h2 className="sr-only">Your bag</h2>
            {items.map((i) => (
              <div key={i.id} className="flex gap-4 border-b border-border pb-6">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden bg-ivory-dark">
                  {i.imageUrl ? (
                    <Image src={i.imageUrl} alt={i.productName} fill className="object-cover" sizes="80px" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-base text-charcoal">{i.productName}</p>
                    <p className="shrink-0 tabular-nums font-medium text-charcoal">
                      {formatPrice(cartLineAmountInCurrency(i, currency, rates), currency)}
                    </p>
                  </div>
                  <p className="mt-0.5 font-body text-sm text-charcoal-mid">
                    {[i.optionLabel, i.sizeMode === "CUSTOM" ? "Made to your measurements" : i.size, i.color]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {i.sizeMode === "CUSTOM" && i.measurements?.length ? (
                    <p className="mt-1 text-xs text-charcoal-mid">
                      {i.measurements.map((m) => `${m.label}: ${m.typedValue} ${m.typedUnit}`).join(" · ")}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center gap-2">
                    <BagQtyButtons
                      item={i}
                      onDecrease={() => void changeQty(i.id, Math.max(1, i.quantity - 1))}
                      onIncrease={() => void changeQty(i.id, i.quantity + 1)}
                    />
                    <button
                      type="button"
                      className="ml-auto min-h-11 font-body text-[11px] uppercase tracking-wider text-dark-grey underline underline-offset-4 hover:text-choc"
                      aria-label={`Remove ${i.productName} from bag`}
                      onClick={() => void removeFromBag(i.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {isGuest && (
              <Input
                id="guest-email"
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={guestEmail}
                error={errors.guestEmail}
                onBlur={() => {
                  guestEmailTouched.current = true;
                  validateGuestEmail();
                }}
                onChange={(e) => {
                  guestEmailTouched.current = true;
                  setGuestEmail(e.target.value);
                  clearFieldError("guestEmail");
                }}
              />
            )}

            <div className="flex min-w-0 items-end gap-2">
              <Input
                id="coupon-code"
                label="Coupon code"
                autoComplete="off"
                className="min-w-0 flex-1"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              />
              <Button type="button" variant="ghost-light" onClick={() => void applyCoupon()} disabled={couponLoading} className="mb-1">
                {couponLoading ? "…" : "Apply"}
              </Button>
            </div>
            {isGuest && !guestEmail.trim() && (
              <p className="text-sm text-text-mid">Enter your email above, then apply your coupon.</p>
            )}
            {couponResult && !couponResult.valid && (
              <p className="text-sm text-error" role="alert">
                {couponResult.error}
              </p>
            )}
            {couponResult?.valid && (
              <p className="text-sm text-success">
                {couponResult.isFreeShipping ? "Free shipping applied" : `₦${couponResult.discountNGN.toLocaleString()} off`}
              </p>
            )}
            {session?.user && availablePoints > 0 && (
              <div>
                <Input
                  id="points-redeem"
                  label={`Redeem Prudent Points (max ${maxPts.toLocaleString()} · ${formatPrice(extrasAmountInCurrency(clampRedemption({ requested: maxPts, availablePoints, subtotalNGN, discountNGN: discNGN, rateNGN: pointRate, minRedemption: 0 }).valueNGN, currency, rates), currency)})`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={maxPts}
                  value={pointsToRedeem}
                  onChange={(e) => setPointsToRedeem(Number(e.target.value) || 0)}
                />
                {pointsToRedeem > 0 ? (
                  <p className="mt-1 font-sans text-xs text-charcoal-mid">
                    {clampedPts.points.toLocaleString()} pts ={" "}
                    {formatPrice(extrasAmountInCurrency(pointsValueNGN, currency, rates), currency)}. Remaining to pay{" "}
                    {formatPrice(payableShopper, currency)}. Shipping cannot be paid with points.
                    {pointsToRedeem > 0 && pointsToRedeem < minRedemption
                      ? ` Minimum redemption is ${minRedemption} points.`
                      : ""}
                  </p>
                ) : null}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
              This is a gift
            </label>
            {isGift && (
              <div>
                <label htmlFor="gift-message" className="mb-1 block font-body text-sm text-charcoal">
                  Gift message
                </label>
                <textarea
                  id="gift-message"
                  className="w-full min-h-[88px] border-0 border-b border-border bg-transparent p-0 py-2 font-body text-base text-charcoal outline-none focus:border-b-2 focus:border-choc"
                  maxLength={200}
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                />
              </div>
            )}
            <Button type="button" className="w-full" size="lg" onClick={goToDelivery}>
              Continue to delivery
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 pt-8">
            <h2 className="sr-only">Delivery</h2>
            {isGuest && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  id="guest-email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className="sm:col-span-2"
                  value={guestEmail}
                  error={errors.guestEmail}
                  onBlur={() => validateGuestEmail()}
                  onChange={(e) => {
                    setGuestEmail(e.target.value);
                    clearFieldError("guestEmail");
                  }}
                />
                <Input
                  id="guest-name"
                  label="Full name"
                  autoComplete="name"
                  className="sm:col-span-2"
                  value={guestName}
                  error={errors.guestName}
                  onBlur={() => {
                    if (!guestName.trim()) setFieldError("guestName", "Full name is required");
                    else clearFieldError("guestName");
                  }}
                  onChange={(e) => {
                    setGuestName(e.target.value);
                    clearFieldError("guestName");
                  }}
                />
                <Input
                  id="guest-phone"
                  label="Phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  className="sm:col-span-2"
                  value={guestPhone}
                  error={errors.guestPhone}
                  onBlur={() => {
                    if (!guestPhone.trim() || guestPhone.replace(/\D/g, "").length < 7) {
                      setFieldError("guestPhone", "Enter a phone number we can reach you on");
                    } else clearFieldError("guestPhone");
                  }}
                  onChange={(e) => {
                    setGuestPhone(e.target.value);
                    clearFieldError("guestPhone");
                  }}
                />
              </div>
            )}
            {savedAddresses.length > 0 && (
              <div className="space-y-2">
                {savedAddresses.map((a) => (
                  <label key={a.id} className={clsx(
                    "flex cursor-pointer gap-3 border p-4",
                    addressId === a.id ? "border-choc bg-[rgba(68,41,19,0.04)]" : "border-border",
                  )}>
                    <input type="radio" name="addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                    <span className="text-sm">
                      {a.firstName} {a.lastName} — {a.street}, {a.city}
                    </span>
                  </label>
                ))}
                <button type="button" className="text-sm text-choc" onClick={() => setAddressId(null)}>
                  Use a different address
                </button>
              </div>
            )}
            {!addressId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  id="addr-first-name"
                  label="First name"
                  autoComplete="given-name"
                  value={addr.firstName ?? ""}
                  error={errors.firstName}
                  onBlur={() => {
                    if (!addr.firstName?.trim()) setFieldError("firstName", "First name is required");
                    else clearFieldError("firstName");
                  }}
                  onChange={(e) => {
                    setAddr((p) => ({ ...p, firstName: e.target.value }));
                    clearFieldError("firstName");
                  }}
                />
                <Input
                  id="addr-last-name"
                  label="Last name"
                  autoComplete="family-name"
                  value={addr.lastName ?? ""}
                  error={errors.lastName}
                  onBlur={() => {
                    if (!addr.lastName?.trim()) setFieldError("lastName", "Last name is required");
                    else clearFieldError("lastName");
                  }}
                  onChange={(e) => {
                    setAddr((p) => ({ ...p, lastName: e.target.value }));
                    clearFieldError("lastName");
                  }}
                />
                <Input
                  id="addr-phone"
                  label="Phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  className="sm:col-span-2"
                  value={addr.phone ?? ""}
                  error={errors.phone}
                  onBlur={() => {
                    if (!addr.phone?.trim() || addr.phone.replace(/\D/g, "").length < 7) {
                      setFieldError("phone", "Enter a phone number");
                    } else clearFieldError("phone");
                  }}
                  onChange={(e) => {
                    setAddr((p) => ({ ...p, phone: e.target.value }));
                    clearFieldError("phone");
                  }}
                />
                <label className="block sm:col-span-2">
                  <span className="mb-1 block font-body text-sm text-charcoal">Country</span>
                  <select
                    id="addr-country"
                    className={fieldSelectClass}
                    value={addr.country ?? "NG"}
                    onChange={(e) => {
                      const country = e.target.value;
                      setAddr((p) => ({
                        ...p,
                        country,
                        state: country === "NG" ? p.state || "Lagos" : "",
                      }));
                      clearFieldError("country");
                    }}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.country} />
                </label>
                {addr.country === "NG" ? (
                  <label className="block">
                    <span className="mb-1 block font-body text-sm text-charcoal">State</span>
                    <select
                      id="addr-state"
                      className={fieldSelectClass}
                      value={addr.state ?? ""}
                      onChange={(e) => {
                        setAddr((p) => ({ ...p, state: e.target.value }));
                        clearFieldError("state");
                      }}
                    >
                      <option value="">Select state</option>
                      {NIGERIA_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.state} />
                  </label>
                ) : (
                  <Input
                    id="addr-state"
                    label="Region / state"
                    autoComplete="address-level1"
                    value={addr.state ?? ""}
                    error={errors.state}
                    onChange={(e) => {
                      setAddr((p) => ({ ...p, state: e.target.value }));
                      clearFieldError("state");
                    }}
                  />
                )}
                {!isPickup ? (
                  <>
                <Input
                  id="addr-line1"
                  label="Address line 1"
                  autoComplete="address-line1"
                  className="sm:col-span-2"
                  value={addr.line1 ?? ""}
                  error={errors.line1}
                  onBlur={() => {
                    if (!addr.line1?.trim() || addr.line1.trim().length < 3) {
                      setFieldError("line1", "Street address is required");
                    } else clearFieldError("line1");
                  }}
                  onChange={(e) => {
                    setAddr((p) => ({ ...p, line1: e.target.value }));
                    clearFieldError("line1");
                  }}
                />
                <Input
                  id="addr-city"
                  label="City"
                  autoComplete="address-level2"
                  value={addr.city ?? ""}
                  error={errors.city}
                  onBlur={() => {
                    if (!addr.city?.trim()) setFieldError("city", "City is required");
                    else clearFieldError("city");
                  }}
                  onChange={(e) => {
                    setAddr((p) => ({ ...p, city: e.target.value }));
                    clearFieldError("city");
                  }}
                />
                  </>
                ) : null}
                {session?.user && (
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(addr.saveAddress)}
                      onChange={(e) => setAddr((p) => ({ ...p, saveAddress: e.target.checked }))}
                    />
                    Save this address
                  </label>
                )}
              </div>
            )}
            <fieldset id="shipping-method">
              <legend className="mb-2 font-body text-base font-medium">Shipping method</legend>
              {shipLoading ? (
                <div className="space-y-2" aria-busy="true" aria-label="Loading shipping methods">
                  <div className="h-16 animate-pulse rounded-sm bg-sand/70" />
                  <div className="h-16 animate-pulse rounded-sm bg-sand/50" />
                </div>
              ) : null}
              {!shipLoading && shippingOpts.length === 0 && (
                <p className="font-body text-base text-charcoal-mid">Enter your city and state to see shipping options.</p>
              )}
              {shippingOpts.map((z) => (
                <label key={z.zoneId} className={clsx(
                  "mb-2 flex cursor-pointer gap-3 border p-4 transition-colors",
                  zoneId === z.zoneId ? "border-choc bg-[rgba(68,41,19,0.04)]" : "border-border hover:border-choc/40",
                )}>
                  <input type="radio" name="ship" checked={zoneId === z.zoneId} onChange={() => setZoneId(z.zoneId)} />
                  <span className="font-body text-base leading-6">
                    {z.zoneName} — {z.isFree ? <span className="text-gold">FREE</span> : `₦${z.costNGN.toLocaleString()}`} · {z.estimatedDays}
                    {z.requiresConsent ? <span className="mt-1 block text-sm text-charcoal-mid">{z.description}</span> : null}
                  </span>
                </label>
              ))}
              {needsConsent ? (
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={shippingConsent}
                    onChange={(e) => {
                      setShippingConsent(e.target.checked);
                      clearFieldError("consent");
                    }}
                  />
                  <span>{quoteConsent}</span>
                </label>
              ) : null}
              {needsConsent ? (
                <fieldset className="mt-4">
                  <legend className="mb-2 font-medium">How should we reach you about delivery?</legend>
                  <p className="mb-2 text-xs text-charcoal-mid">
                    We contact you once the piece is packed, to agree the courier and cost.
                  </p>
                  {(
                    [
                      ["WHATSAPP", "WhatsApp"],
                      ["CALL", "Phone call"],
                      ["EMAIL", "Email"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="mb-1 flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="preferred-contact"
                        checked={preferredContact === value}
                        onChange={() => setPreferredContact(value)}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <FieldError message={errors.shipping} />
              <FieldError message={errors.consent} />
            </fieldset>
            {hasCustom && customNotReturnable ? (
              <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={customReturnConsent}
                  onChange={(e) => {
                    setCustomReturnConsent(e.target.checked);
                    setErrors((p) => {
                      const next = { ...p };
                      delete next.customReturn;
                      return next;
                    });
                  }}
                />
                <span>{CUSTOM_RETURNS_COPY}</span>
              </label>
            ) : null}
            <FieldError message={errors.customReturn} />
            <div>
              <label htmlFor="order-notes" className="mb-1 block font-body text-sm text-charcoal">
                Order notes (optional)
              </label>
              <textarea
                id="order-notes"
                className="w-full min-h-[96px] border-0 border-b border-border bg-transparent p-0 py-2 font-body text-base text-charcoal outline-none focus:border-b-2 focus:border-choc"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="ghost-light" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" className="flex-1" onClick={goToPayment}>
                Continue to payment
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 pt-8">
            <h2 className="sr-only">Payment</h2>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-body text-sm text-charcoal-mid">Pay in</p>
                <p className="mt-1 font-display text-2xl tabular-nums text-choc">
                  {formatPrice(payableShopper, currency)}
                </p>
                {currency !== "NGN" ? (
                  <p className="mt-1 font-body text-sm text-charcoal-mid">
                    About ₦{Math.round(payable).toLocaleString("en-NG")} at today’s atelier rate
                  </p>
                ) : null}
              </div>
              <div
                className="inline-flex w-fit overflow-hidden rounded-none border border-border p-0.5"
                role="group"
                aria-label="Currency"
              >
                {(["NGN", "USD", "GBP"] as ShopCurrency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    aria-pressed={currency === c}
                    className={clsx(
                      "min-h-10 min-w-[3.25rem] rounded-none px-3 font-body text-sm transition-colors",
                      currency === c
                        ? "bg-choc text-cream"
                        : "text-charcoal-mid hover:text-choc",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {payable > 0.01 ? (
              <div id="payment-method" className="space-y-5">
                <PrudentPointsPayOption
                  isGuest={status !== "authenticated"}
                  availablePoints={availablePoints}
                  maxPts={maxPts}
                  minRedemption={minRedemption}
                  pointsToRedeem={pointsToRedeem}
                  onChange={setPointsToRedeem}
                  maxValueLabel={formatPrice(
                    extrasAmountInCurrency(
                      clampRedemption({
                        requested: maxPts,
                        availablePoints,
                        subtotalNGN,
                        discountNGN: discNGN,
                        rateNGN: pointRate,
                        minRedemption: 0,
                      }).valueNGN,
                      currency,
                      rates,
                    ),
                    currency,
                  )}
                  remainingLabel={formatPrice(payableShopper, currency)}
                  applied={pointsValueNGN > 0}
                />
                <PaymentMethodSelector
                  currency={currency}
                  businessLine="RTW"
                  amount={payableShopper}
                  amountNGN={payable}
                  paymentReference={paymentRef}
                  selected={gateway}
                  onSelect={(g) => {
                    setGateway(g);
                    clearFieldError("gateway");
                    if (g !== "BANK_TRANSFER") setReceiptUrl(null);
                  }}
                  receiptUrl={receiptUrl}
                  onReceiptUploaded={(url) => {
                    setReceiptUrl(url);
                    clearFieldError("receipt");
                    const existing = createdOrderRef.current;
                    if (!existing?.id) return;
                    void (async () => {
                      try {
                        const bt = await fetch("/api/checkout/bank-transfer", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            orderId: existing.id,
                            receiptUrl: url,
                            guestEmail: guestEmail || undefined,
                          }),
                        });
                        const btj = await readJsonBody(bt);
                        if (!bt.ok) throw new Error(jsonErrorMessage(btj.error, "Could not submit receipt"));
                        window.location.href = btj.redirectUrl as string;
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not submit receipt");
                      }
                    })();
                  }}
                  guestEmail={guestEmail || session?.user?.email}
                />
                <FieldError message={errors.gateway} />
                <FieldError message={errors.receipt} />
              </div>
            ) : (
              <p className="border-b border-border pb-6 font-body text-base leading-6 text-charcoal">
                Prudent Points cover this order. Shipping is not included — collection and quoted shipping stay
                payable separately when they apply.
              </p>
            )}
            {isInternational && dduDisclosure ? (
              <p className="font-body text-sm leading-6 text-charcoal-mid">{dduDisclosure}</p>
            ) : null}
            {!stripeClientSecret && (
              <div className="flex flex-col-reverse gap-3 border-t border-border pt-8 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="min-h-11 font-body text-sm text-charcoal-mid underline underline-offset-4 hover:text-choc"
                  onClick={() => setStep(2)}
                >
                  Back to delivery
                </button>
                <Button
                  type="button"
                  className="sm:ml-auto sm:min-w-[14rem]"
                  size="lg"
                  disabled={submitting || (payable > 0.01 && !gateway)}
                  aria-busy={submitting}
                  onClick={() => void submitOrder()}
                >
                  {submitting
                    ? "Please wait…"
                    : payable <= 0.01
                      ? "Place order"
                      : gateway === "BANK_TRANSFER"
                        ? "Confirm order"
                        : `Pay ${formatPrice(payableShopper, currency)}`}
                </Button>
              </div>
            )}
            {stripeClientSecret && stripePk && createdOrder && stripeReturnUrl && (
              <StripePayBlock clientSecret={stripeClientSecret} publishableKey={stripePk} returnUrl={stripeReturnUrl} />
            )}
          </div>
        )}
      </div>

      <aside className="w-full min-w-0 shrink-0 lg:sticky lg:top-24 lg:w-[340px]">
        <OrderSummary
          items={items}
          couponResult={couponResult}
          pointsToRedeem={clampedPts.points}
          pointsValueNGN={pointsValueNGN}
          shippingCostNGN={shipCost}
          shippingIsFree={Boolean(selectedShip?.isFree)}
          shippingQuoted={Boolean(selectedShip?.requiresConsent || selectedShip?.kind === "QUOTE_PENDING")}
          currency={currency}
          step={step}
          pointRate={pointRate}
        />
      </aside>
    </div>
  );
}
