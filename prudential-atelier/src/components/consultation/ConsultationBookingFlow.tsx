"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";
import { Check } from "lucide-react";
import toast from "react-hot-toast";
import type { ConsultantWithOfferings } from "@/lib/consultation";
import {
  addDaysToWatYmd,
  getWatYmd,
  isManualFlow,
  isVirtualDelivery,
} from "@/lib/consultation";
import type { ConsultantOffering, Currency } from "@prisma/client";
import { ConsultationDeliveryMode as DeliveryMode } from "@prisma/client";
import { StripePayBlock } from "@/components/checkout/StripePayBlock";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import type { PaymentGatewayType } from "@/lib/payments/index";
import { formatPrice } from "@/lib/currency";
import { cmsGet } from "@/lib/cms-helpers";

type Gateway = PaymentGatewayType;
type ShopCur = "NGN" | "USD" | "GBP";
type CardKey = "signature" | "design-team" | "virtual";

const OCCASIONS = [
  "White Wedding",
  "Traditional Wedding",
  "Wedding Guest",
  "Engagement",
  "Corporate Event",
  "Birthday",
  "Gala/Red Carpet",
  "AMVCA/Awards",
  "Naming/Dedication",
  "Wardrobe Refresh",
  "Other",
];

const VIRTUAL_PLATFORMS = ["Zoom", "Google Meet", "WhatsApp Call", "WhatsApp Video"] as const;

const CARD_UI: Record<
  CardKey,
  {
    typeLabel: string;
    title: string;
    description: string;
    features: string[];
    badge?: string;
    match: (c: ConsultantWithOfferings, o: ConsultantOffering) => boolean;
  }
> = {
  signature: {
    typeLabel: "SIGNATURE",
    title: "In-Person with Mrs. Prudent",
    description: "A private session with the Creative Director herself. The full atelier experience.",
    features: ["Direct with the Creative Director", "Premium fabric library access", "Up to 90 minutes"],
    badge: "SIGNATURE",
    match: (c, o) =>
      c.isFlagship &&
      (o.deliveryMode === DeliveryMode.INPERSON_ATELIER_PRUDENT ||
        o.deliveryMode === DeliveryMode.INPERSON_HOME_PRUDENT),
  },
  "design-team": {
    typeLabel: "IN-PERSON",
    title: "With the Design Team",
    description: "Sit with our senior designers in the Lagos atelier to shape your commission.",
    features: ["Senior design team", "In-atelier fabric viewing", "Up to 60 minutes"],
    match: (c, o) =>
      !c.isFlagship &&
      (o.deliveryMode === DeliveryMode.INPERSON_ATELIER ||
        o.deliveryMode === DeliveryMode.INPERSON_HOME_TEAM),
  },
  virtual: {
    typeLabel: "VIRTUAL",
    title: "Virtual Consultation",
    description: "Meet us from anywhere — Zoom, Google Meet or WhatsApp. Link sent an hour before.",
    features: ["Zoom · Meet · WhatsApp", "Screen-shared lookbook", "Up to 45 minutes"],
    match: (c, o) =>
      !c.isFlagship &&
      (o.deliveryMode === DeliveryMode.VIRTUAL_STANDARD ||
        o.deliveryMode === DeliveryMode.VIRTUAL_WITH_TEAM ||
        o.deliveryMode === DeliveryMode.PHONE_CALL),
  },
};

const CARD_CMS_PREFIX: Record<CardKey, string> = {
  signature: "consultation_type1",
  "design-team": "consultation_type2",
  virtual: "consultation_type3",
};

function getCardConfig(key: CardKey, cms: Record<string, string>) {
  const base = CARD_UI[key];
  const prefix = CARD_CMS_PREFIX[key];
  const badge = cmsGet(cms, `${prefix}_badge`, base.badge ?? "");
  const features = [
    cmsGet(cms, `${prefix}_feature_1`, base.features[0] ?? ""),
    cmsGet(cms, `${prefix}_feature_2`, base.features[1] ?? ""),
    cmsGet(cms, `${prefix}_feature_3`, base.features[2] ?? ""),
  ].filter(Boolean);

  return {
    ...base,
    typeLabel: badge || base.typeLabel,
    title: cmsGet(cms, `${prefix}_title`, base.title),
    description: cmsGet(cms, `${prefix}_description`, base.description),
    features: features.length ? features : base.features,
    badge: badge || base.badge,
  };
}

function resolveCard(
  consultants: ConsultantWithOfferings[],
  key: CardKey,
): { consultant: ConsultantWithOfferings; offering: ConsultantOffering } | null {
  const cfg = CARD_UI[key];
  for (const c of consultants) {
    const offering = c.offerings.find((o) => o.isActive && cfg.match(c, o));
    if (offering) return { consultant: c, offering };
  }
  for (const c of consultants) {
    if (key === "signature" && c.isFlagship && c.offerings[0]) {
      return { consultant: c, offering: c.offerings[0] };
    }
    if (key === "design-team" && !c.isFlagship && c.offerings[0]) {
      return { consultant: c, offering: c.offerings[0] };
    }
    if (key === "virtual" && !c.isFlagship && c.offerings[0]) {
      return { consultant: c, offering: c.offerings[0] };
    }
  }
  return null;
}

function StepIndicator({ step }: { step: number }) {
  const steps = [
    { n: 1, label: "CHOOSE" },
    { n: 2, label: "SCHEDULE" },
    { n: 3, label: "CONFIRM" },
  ];
  return (
    <div className="mb-12 flex items-center justify-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={clsx(
                "flex h-3 w-3 items-center justify-center rounded-full border",
                step >= s.n ? "border-choc bg-choc" : "border-sand bg-white",
              )}
            />
            <span
              className={clsx(
                "mt-2 font-sans text-[10px] uppercase tracking-[0.14em]",
                step === s.n ? "font-semibold text-choc" : "font-normal text-text-light",
              )}
            >
              {s.n} {s.label}
            </span>
          </div>
          {i < steps.length - 1 ? (
            <div className={clsx("mx-4 mb-5 h-px w-16 sm:w-24", step > s.n ? "bg-choc" : "bg-sand")} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ConsultationBookingFlow({
  consultants,
  cms = {},
}: {
  consultants: ConsultantWithOfferings[];
  cms?: Record<string, string>;
}) {
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [selectedCard, setSelectedCard] = useState<CardKey | null>(null);
  const [consultant, setConsultant] = useState<ConsultantWithOfferings | null>(null);
  const [offering, setOffering] = useState<ConsultantOffering | null>(null);
  const [manualFlow, setManualFlow] = useState(false);

  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [pref1, setPref1] = useState("");
  const [pref2, setPref2] = useState("");
  const [pref3, setPref3] = useState("");
  const [virtualPlatform, setVirtualPlatform] = useState<string>(VIRTUAL_PLATFORMS[0]);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const clientCountry = "NG";
  const clientInstagram = "";
  const [occasion, setOccasion] = useState("");
  const [description, setDescription] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [currency, setCurrency] = useState<ShopCur>("NGN");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingNumber, setBookingNumber] = useState<string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePk, setStripePk] = useState("");
  const minManualDate = useMemo(() => addDaysToWatYmd(getWatYmd(), 3), []);

  useEffect(() => {
    if (session?.user?.name) setClientName(session.user.name);
    if (session?.user?.email) setClientEmail(session.user.email);
  }, [session]);

  function selectCard(key: CardKey) {
    const resolved = resolveCard(consultants, key);
    if (!resolved) {
      toast.error("This consultation type is not available right now.");
      return;
    }
    setSelectedCard(key);
    setConsultant(resolved.consultant);
    setOffering(resolved.offering);
    setManualFlow(isManualFlow(resolved.offering.deliveryMode, resolved.consultant.isFlagship));
  }

  const loadAvailableDates = useCallback(async () => {
    if (!consultant || !offering || manualFlow) return;
    setCalLoading(true);
    try {
      const res = await fetch(
        `/api/consultants/${consultant.id}/available-dates?durationMinutes=${offering.durationMinutes}`,
      );
      const j = (await res.json()) as { dates?: string[] };
      if (!res.ok) throw new Error("Could not load calendar");
      setAvailableDates(j.dates ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Calendar error");
    } finally {
      setCalLoading(false);
    }
  }, [consultant, offering, manualFlow]);

  useEffect(() => {
    if (step === 2 && consultant && offering && !manualFlow) {
      void loadAvailableDates();
    }
  }, [step, consultant, offering, manualFlow, loadAvailableDates]);

  const loadSlots = useCallback(
    async (ymd: string) => {
      if (!consultant || !offering) return;
      setCalLoading(true);
      try {
        const res = await fetch(
          `/api/consultants/${consultant.id}/slots?date=${encodeURIComponent(ymd)}&offeringId=${offering.id}`,
        );
        const j = (await res.json()) as { slots?: string[] };
        if (!res.ok) throw new Error("Could not load slots");
        setSlots(j.slots ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Slots error");
      } finally {
        setCalLoading(false);
      }
    },
    [consultant, offering],
  );

  useEffect(() => {
    if (selectedYmd && step === 2 && !manualFlow) void loadSlots(selectedYmd);
  }, [selectedYmd, step, manualFlow, loadSlots]);

  async function uploadRef(file: File) {
    if (referenceImages.length >= 5) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/consultations/upload", { method: "POST", body: fd });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Upload failed");
      if (j.url) setReferenceImages((prev) => [...prev, j.url!]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const stripeReturnUrl =
    typeof window !== "undefined" && bookingNumber
      ? `${window.location.origin}/consultation/success?booking=${encodeURIComponent(bookingNumber)}`
      : "";

  async function pay() {
    if (!offering || !consultant || !gateway) {
      toast.error("Select a payment method");
      return;
    }
    setSubmitting(true);
    try {
      const confirmedDate =
        !manualFlow && selectedYmd ? new Date(`${selectedYmd}T12:00:00+01:00`) : undefined;
      const body = {
        offeringId: offering.id,
        consultantId: consultant.id,
        currency: currency as Currency,
        gateway,
        clientName,
        clientEmail,
        clientPhone,
        clientCountry,
        clientInstagram: clientInstagram || undefined,
        occasion,
        description:
          offering && isVirtualDelivery(offering.deliveryMode) && virtualPlatform
            ? `${description}\n\nPreferred platform: ${virtualPlatform}`
            : description,
        referenceImages,
        confirmedDate,
        confirmedTime: !manualFlow ? selectedTime ?? undefined : undefined,
        preferredDate1: manualFlow && pref1 ? new Date(pref1) : undefined,
        preferredDate2: manualFlow && pref2 ? new Date(pref2) : undefined,
        preferredDate3: manualFlow && pref3 ? new Date(pref3) : undefined,
      };

      const cr = await fetch("/api/consultations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const cj = (await cr.json()) as { bookingId?: string; bookingNumber?: string; error?: unknown };
      if (!cr.ok) throw new Error(typeof cj.error === "string" ? cj.error : "Could not create booking");
      const bid = cj.bookingId!;
      const bnum = cj.bookingNumber!;
      setBookingNumber(bnum);

      if (gateway === "STRIPE") {
        const stripeCurrency = currency === "GBP" ? "GBP" : "USD";
        const pr = await fetch("/api/consultations/payment/stripe/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: bid,
            currency: stripeCurrency,
            guestEmail: session?.user ? undefined : clientEmail,
          }),
        });
        const pj = await pr.json();
        if (!pr.ok) throw new Error((pj as { error?: string }).error ?? "Stripe failed");
        setStripeClientSecret((pj as { clientSecret: string }).clientSecret);
        setStripePk((pj as { publishableKey: string }).publishableKey ?? "");
        setSubmitting(false);
        return;
      }

      const initBody: Record<string, string> = { bookingId: bid };
      if (!session?.user) initBody.guestEmail = clientEmail;

      if (gateway === "PAYSTACK") {
        const pr = await fetch("/api/consultations/payment/paystack/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initBody),
        });
        const pj = await pr.json();
        if (!pr.ok) throw new Error((pj as { error?: string }).error ?? "Paystack failed");
        window.location.href = (pj as { authorizationUrl: string }).authorizationUrl;
        return;
      }

      if (gateway === "FLUTTERWAVE") {
        const pr = await fetch("/api/consultations/payment/flutterwave/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...initBody, currency }),
        });
        const pj = await pr.json();
        if (!pr.ok) throw new Error((pj as { error?: string }).error ?? "Flutterwave failed");
        window.location.href = (pj as { paymentLink: string }).paymentLink;
        return;
      }

      if (gateway === "MONNIFY") {
        const pr = await fetch("/api/consultations/payment/monnify/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initBody),
        });
        const pj = await pr.json();
        if (!pr.ok) throw new Error((pj as { error?: string }).error ?? "Monnify failed");
        window.location.href = (pj as { checkoutUrl: string }).checkoutUrl;
        return;
      }

      if (gateway === "BANK_TRANSFER") {
        if (!receiptUrl) throw new Error("Upload your payment receipt");
        const bt = await fetch("/api/consultations/bank-transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: bid,
            receiptUrl,
            guestEmail: session?.user ? undefined : clientEmail,
          }),
        });
        const btj = await bt.json();
        if (!bt.ok) throw new Error((btj as { error?: string }).error ?? "Could not submit receipt");
        window.location.href = (btj as { redirectUrl: string }).redirectUrl;
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    }
    setSubmitting(false);
  }

  const stepValid =
    step === 1
      ? Boolean(selectedCard && consultant && offering)
      : step === 2
        ? manualFlow
          ? Boolean(pref1)
          : Boolean(selectedYmd && selectedTime)
        : step === 3
          ? clientName.length >= 2 &&
            clientEmail.includes("@") &&
            clientPhone.length >= 7 &&
            occasion &&
            description.length >= 20 &&
            Boolean(gateway) &&
            (gateway !== "BANK_TRANSFER" || Boolean(receiptUrl))
          : false;

  const cardKeys: CardKey[] = ["signature", "design-team", "virtual"];
  const showVirtualPlatform = offering && isVirtualDelivery(offering.deliveryMode);

  return (
    <div className="bg-ivory px-4 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lightbr">
            {cmsGet(cms, "consultation_page_eyebrow", "BOOK A CONSULTATION")}
          </p>
          <h1 className="mt-3 font-serif text-[40px] font-normal leading-tight text-choc md:text-[56px]">
            {cmsGet(cms, "consultation_page_title", "Sit with us")}
          </h1>
          <p className="mx-auto mt-4 max-w-[480px] font-body text-[15px] leading-relaxed text-text-mid">
            {cmsGet(
              cms,
              "consultation_page_subtitle",
              "Tell us the occasion, and we'll design around your story. Payment is taken at booking to reserve your time.",
            )}
          </p>
        </header>

        <StepIndicator step={step} />

        {step === 1 && (
          <div>
            <div className="grid gap-5 md:grid-cols-3">
              {cardKeys.map((key) => {
                const cfg = getCardConfig(key, cms);
                const resolved = resolveCard(consultants, key);
                const price = resolved?.offering.feeNGN ?? 0;
                const selected = selectedCard === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectCard(key)}
                    className={clsx(
                      "relative rounded-lg border bg-white p-8 text-left transition-shadow",
                      selected
                        ? "border-[1.5px] border-choc shadow-[0_4px_24px_rgba(68,41,19,0.08)]"
                        : "border-[0.5px] border-sand hover:border-nut/40",
                    )}
                  >
                    {cfg.badge ? (
                      <span className="absolute left-4 top-4 rounded-full bg-gold px-2.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wide text-white">
                        {cfg.badge}
                      </span>
                    ) : null}
                    <p className={clsx("font-sans text-[10px] uppercase tracking-[0.14em] text-lightbr", cfg.badge && "mt-6")}>
                      {cfg.typeLabel}
                    </p>
                    <h3 className="mt-2 font-serif text-[24px] leading-snug text-choc md:text-[28px]">{cfg.title}</h3>
                    <p className="mt-3 font-body text-[13px] leading-relaxed text-text-mid">{cfg.description}</p>
                    <ul className="mt-5 space-y-2">
                      {cfg.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 font-body text-[13px] text-text-mid">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-nut" strokeWidth={2.5} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 flex items-end justify-between">
                      <p className="font-serif text-[28px] text-choc">
                        ₦{price.toLocaleString("en-NG")}
                      </p>
                      <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-text-light">
                        {selected ? "SELECTED" : "SELECT"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-10 flex justify-center">
              <button
                type="button"
                disabled={!stepValid}
                onClick={() => setStep(2)}
                className={clsx(
                  "rounded-sm px-12 py-4 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-cream transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  stepValid ? "bg-nut hover:bg-choc" : "bg-sand text-text-mid",
                )}
              >
                Continue to schedule →
              </button>
            </div>
          </div>
        )}

        {step === 2 && consultant && offering && (
          <div className="mx-auto max-w-xl">
            <h2 className="text-center font-serif text-[32px] text-choc">Choose your time</h2>
            <p className="mt-2 text-center font-body text-sm text-text-mid">
              All times are West Africa Time (WAT · UTC+1)
            </p>

            {manualFlow ? (
              <div className="mt-8 space-y-4">
                <div className="rounded-lg border border-sand bg-white p-4 font-body text-sm text-text-mid">
                  As Mrs. Prudent personally conducts these sessions, scheduling is coordinated with her team. Submit
                  up to three preferred dates; we will confirm within 24–48 hours.
                </div>
                <label className="block text-sm">
                  <span className="font-sans text-text-mid">1st preference (required)</span>
                  <input
                    type="date"
                    min={minManualDate}
                    value={pref1}
                    onChange={(e) => setPref1(e.target.value)}
                    className="input-field mt-1 w-full"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-sans text-text-mid">2nd preference</span>
                  <input
                    type="date"
                    min={minManualDate}
                    value={pref2}
                    onChange={(e) => setPref2(e.target.value)}
                    className="input-field mt-1 w-full"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-sans text-text-mid">3rd preference</span>
                  <input
                    type="date"
                    min={minManualDate}
                    value={pref3}
                    onChange={(e) => setPref3(e.target.value)}
                    className="input-field mt-1 w-full"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-8">
                <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-lightbr">Select date</p>
                {calLoading && !selectedYmd ? (
                  <p className="mt-3 font-body text-sm text-text-mid">Loading calendar…</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availableDates.slice(0, 28).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSelectedYmd(d);
                          setSelectedTime(null);
                        }}
                        className={clsx(
                          "rounded-sm border px-3 py-2 font-sans text-xs transition-colors",
                          selectedYmd === d ? "border-choc bg-choc text-cream" : "border-sand bg-white text-text-mid",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}

                {selectedYmd ? (
                  <div className="mt-8">
                    <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-lightbr">Available times</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {slots.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTime(t)}
                          className={clsx(
                            "rounded-sm border px-3 py-2 font-sans text-xs transition-colors",
                            selectedTime === t ? "border-choc bg-choc text-cream" : "border-sand bg-white text-text-mid",
                          )}
                        >
                          {t} WAT
                        </button>
                      ))}
                    </div>
                    {!slots.length && !calLoading ? (
                      <p className="mt-2 font-body text-sm text-text-mid">No times on this date.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            {showVirtualPlatform ? (
              <div className="mt-8">
                <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-lightbr">Meeting platform</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {VIRTUAL_PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setVirtualPlatform(p)}
                      className={clsx(
                        "rounded-sm border px-4 py-2 font-sans text-xs transition-colors",
                        virtualPlatform === p ? "border-choc bg-choc text-cream" : "border-sand bg-white text-text-mid",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-10 flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="btn-ghost-light px-6 py-3 text-[10px]">
                Back
              </button>
              <button
                type="button"
                disabled={!stepValid}
                onClick={() => setStep(3)}
                className="flex-1 rounded-sm bg-nut py-4 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-cream disabled:opacity-40"
              >
                Continue to confirm →
              </button>
            </div>
          </div>
        )}

        {step === 3 && consultant && offering && selectedCard && (
          <div className="mx-auto max-w-2xl space-y-8">
            <div className="rounded-lg border border-sand bg-white p-6">
              <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-lightbr">Booking summary</p>
              <h3 className="mt-2 font-serif text-xl text-choc">{CARD_UI[selectedCard].title}</h3>
              <p className="mt-2 font-body text-sm text-text-mid">
                {!manualFlow && selectedYmd
                  ? `${selectedYmd} at ${selectedTime ?? "—"} WAT`
                  : manualFlow
                    ? "Preferred dates pending confirmation"
                    : "—"}
              </p>
              {showVirtualPlatform ? (
                <p className="mt-1 font-body text-sm text-text-mid">Platform: {virtualPlatform}</p>
              ) : null}
              <p className="mt-4 font-serif text-[28px] text-choc">₦{offering.feeNGN.toLocaleString("en-NG")}</p>
            </div>

            <div className="space-y-4 rounded-lg border border-sand bg-white p-6">
              <h3 className="font-serif text-xl text-choc">Your details</h3>
              <input
                placeholder="Full name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="input-field w-full"
              />
              <input
                type="email"
                placeholder="Email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="input-field w-full"
              />
              <input
                placeholder="Phone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="input-field w-full"
              />
              <label className="block text-sm">
                <span className="font-sans text-text-mid">Occasion</span>
                <select className="input-field mt-1 w-full" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
                  <option value="">Select…</option>
                  {OCCASIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-sans text-text-mid">Tell us about your vision (min 20 characters)</span>
                <textarea
                  className="input-field mt-1 min-h-[120px] w-full"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <div>
                <p className="font-sans text-xs text-text-light">Reference images (optional, max 5)</p>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 text-sm"
                  disabled={uploading || referenceImages.length >= 5}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadRef(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-sand bg-white p-6">
              <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-lightbr">Currency</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["NGN", "USD", "GBP"] as ShopCur[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCurrency(c);
                      setGateway(null);
                    }}
                    className={clsx(
                      "rounded-sm border px-4 py-2 font-sans text-xs uppercase",
                      currency === c ? "border-choc bg-choc text-cream" : "border-sand bg-white text-text-mid",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="mt-4 font-serif text-[28px] text-choc">
                {currency === "NGN"
                  ? formatPrice(offering.feeNGN, "NGN")
                  : currency === "USD" && offering.feeUSD
                    ? formatPrice(offering.feeUSD, "USD")
                    : currency === "GBP" && offering.feeGBP
                      ? formatPrice(offering.feeGBP, "GBP")
                      : formatPrice(offering.feeNGN, "NGN")}
              </p>
            </div>

            <PaymentMethodSelector
              currency={currency}
              amount={
                currency === "USD" && offering.feeUSD
                  ? offering.feeUSD
                  : currency === "GBP" && offering.feeGBP
                    ? offering.feeGBP
                    : offering.feeNGN
              }
              selected={gateway}
              onSelect={(g) => {
                setGateway(g);
                if (g !== "BANK_TRANSFER") setReceiptUrl(null);
              }}
              receiptUrl={receiptUrl}
              onReceiptUploaded={setReceiptUrl}
            />

            {stripeClientSecret && stripePk ? (
              <StripePayBlock clientSecret={stripeClientSecret} publishableKey={stripePk} returnUrl={stripeReturnUrl} />
            ) : (
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="btn-ghost-light px-6 py-3 text-[10px]">
                  Back
                </button>
                <button
                  type="button"
                  disabled={!stepValid || submitting}
                  onClick={() => void pay()}
                  className="flex-1 rounded-sm bg-nut py-4 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-cream disabled:opacity-40"
                >
                  {submitting ? "Please wait…" : "Confirm & pay →"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
