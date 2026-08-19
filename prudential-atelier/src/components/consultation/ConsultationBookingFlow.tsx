"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";
import { Check } from "lucide-react";
import toast from "react-hot-toast";
import type { ConsultantWithOfferings } from "@/lib/consultation";
import { addDaysToWatYmd, getWatYmd } from "@/lib/consultation";
import type { ConsultantOffering, Currency } from "@prisma/client";
import {
  getOfferingTypeConfig,
  getVirtualPlatformLabel,
  isOfferingTypeManual,
  isOfferingTypeVirtual,
  OFFERING_TYPES,
  resolveOfferingType,
  VIRTUAL_PLATFORMS,
  type OfferingTypeKey,
  type VirtualPlatformId,
} from "@/lib/consultation-types";
import { StripePayBlock } from "@/components/checkout/StripePayBlock";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import type { PaymentGatewayType } from "@/lib/payments/index";
import { formatPrice } from "@/lib/currency";
import { cmsGet } from "@/lib/cms-helpers";
import { ConsultationReviewsSlider } from "@/components/consultation/ConsultationReviewsSlider";
import type { ConsultationReviewSlide } from "@/lib/consultation-reviews";

type Gateway = PaymentGatewayType;
type ShopCur = "NGN" | "USD" | "GBP";

function prefYmdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+01:00`);
}

function formatPrefYmd(ymd: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(prefYmdToDate(ymd));
}

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
                step >= s.n ? "border-choc bg-choc" : "border-sand bg-bg-card",
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
  consultationReviews = [],
}: {
  consultants: ConsultantWithOfferings[];
  cms?: Record<string, string>;
  consultationReviews?: ConsultationReviewSlide[];
}) {
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<OfferingTypeKey | null>(null);
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
  const [virtualPlatform, setVirtualPlatform] = useState<VirtualPlatformId>("zoom");

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

  function selectType(key: OfferingTypeKey) {
    const cfg = getOfferingTypeConfig(key, cms);
    if (!cfg.enabled) {
      toast.error("This consultation type is not available right now.");
      return;
    }
    const resolved = resolveOfferingType(consultants, key);
    if (!resolved) {
      toast.error("This consultation type is not available right now.");
      return;
    }
    setSelectedType(key);
    setConsultant(resolved.consultant);
    setOffering(resolved.offering);
    setManualFlow(isOfferingTypeManual(key));
  }

  const typeConfig = selectedType ? getOfferingTypeConfig(selectedType, cms) : null;

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
        offeringType: selectedType,
        virtualPlatform: selectedType && isOfferingTypeVirtual(selectedType) ? virtualPlatform : undefined,
        currency: currency as Currency,
        gateway,
        clientName,
        clientEmail,
        clientPhone,
        clientCountry,
        clientInstagram: clientInstagram || undefined,
        occasion,
        description,
        referenceImages,
        confirmedDate,
        confirmedTime: !manualFlow ? selectedTime ?? undefined : undefined,
        preferredDate1: manualFlow && pref1 ? prefYmdToDate(pref1) : undefined,
        preferredDate2: manualFlow && pref2 ? prefYmdToDate(pref2) : undefined,
        preferredDate3: manualFlow && pref3 ? prefYmdToDate(pref3) : undefined,
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
      ? Boolean(selectedType && consultant && offering)
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

  const showVirtualPlatform = selectedType && isOfferingTypeVirtual(selectedType);

  function displayPrice(cur: ShopCur): string {
    if (!typeConfig) return "";
    if (cur === "NGN") return formatPrice(typeConfig.priceNgn, "NGN");
    if (cur === "USD") return formatPrice(typeConfig.priceUsd, "USD");
    return formatPrice(typeConfig.priceGbp, "GBP");
  }

  function paymentAmount(cur: ShopCur): number {
    if (!typeConfig) return 0;
    if (cur === "USD") return typeConfig.priceUsd;
    if (cur === "GBP") return typeConfig.priceGbp;
    return typeConfig.priceNgn;
  }

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
            <div className="grid gap-5 md:grid-cols-2">
              {OFFERING_TYPES.map((key) => {
                const cfg = getOfferingTypeConfig(key, cms);
                if (!cfg.enabled) return null;
                const resolved = resolveOfferingType(consultants, key);
                if (!resolved) return null;
                const selected = selectedType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectType(key)}
                    className={clsx(
                      "relative rounded-lg border bg-bg-card p-8 text-left transition-shadow",
                      selected
                        ? "border-[1.5px] border-choc shadow-[0_4px_24px_rgba(68,41,19,0.08)]"
                        : "border-[0.5px] border-sand hover:border-nut/40",
                    )}
                  >
                    <span className="absolute left-4 top-4 rounded-full bg-gold px-2.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wide text-white">
                      {cfg.formatLabel}
                    </span>
                    <p className="mt-6 font-sans text-[10px] uppercase tracking-[0.14em] text-lightbr">
                      {cfg.isVirtual ? "Virtual" : "In-person"}
                      {cfg.location ? ` · ${cfg.location}` : ""}
                    </p>
                    <h3 className="mt-2 font-serif text-[22px] leading-snug text-choc md:text-[26px]">{cfg.title}</h3>
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
                        {formatPrice(cfg.priceNgn, "NGN")}
                      </p>
                      <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-text-light">
                        {selected ? "SELECTED" : "SELECT"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {showVirtualPlatform ? (
              <div className="mx-auto mt-8 max-w-xl rounded-lg border border-sand bg-bg-card p-6">
                <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-lightbr">Choose your platform</p>
                <div className="mt-4 space-y-3">
                  {VIRTUAL_PLATFORMS.map((p) => (
                    <label
                      key={p.id}
                      className={clsx(
                        "flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 transition-colors",
                        virtualPlatform === p.id ? "border-choc bg-choc/5" : "border-sand",
                      )}
                    >
                      <input
                        type="radio"
                        name="virtualPlatform"
                        checked={virtualPlatform === p.id}
                        onChange={() => setVirtualPlatform(p.id)}
                        className="accent-choc"
                      />
                      <span className="font-body text-sm text-text-mid">{p.label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-4 font-body text-xs text-text-light">
                  A link will be sent to you 1 hour before your session.
                </p>
              </div>
            ) : null}

            <ConsultationReviewsSlider items={consultationReviews} />

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
                <div className="rounded-lg border border-sand bg-bg-card p-4 font-body text-sm text-text-mid">
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
                          selectedYmd === d ? "border-choc bg-choc text-cream" : "border-sand bg-bg-card text-text-mid",
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
                            selectedTime === t ? "border-choc bg-choc text-cream" : "border-sand bg-bg-card text-text-mid",
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

        {step === 3 && consultant && offering && selectedType && typeConfig && (
          <div className="mx-auto max-w-2xl space-y-8">
            <div className="rounded-lg border border-sand bg-bg-card p-6">
              <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-lightbr">Booking summary</p>
              <h3 className="mt-2 font-serif text-xl text-choc">
                {typeConfig.isVirtual ? "💻" : "🏛"} {typeConfig.title}
              </h3>
              <p className="mt-2 font-body text-sm text-text-mid">
                {!manualFlow && selectedYmd
                  ? `${selectedYmd} at ${selectedTime ?? "—"} WAT`
                  : manualFlow && pref1
                    ? [pref1, pref2, pref3]
                        .filter(Boolean)
                        .map((d) => formatPrefYmd(d))
                        .join(" · ")
                    : manualFlow
                      ? "Preferred dates pending confirmation"
                      : "—"}
              </p>
              {showVirtualPlatform ? (
                <p className="mt-1 font-body text-sm text-text-mid">
                  Via {getVirtualPlatformLabel(virtualPlatform)}
                </p>
              ) : null}
              <p className="mt-4 font-serif text-[28px] text-choc">{displayPrice(currency)}</p>
            </div>

            <div className="space-y-4 rounded-lg border border-sand bg-bg-card p-6">
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

            <div className="rounded-lg border border-sand bg-bg-card p-6">
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
                      currency === c ? "border-choc bg-choc text-cream" : "border-sand bg-bg-card text-text-mid",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="mt-4 font-serif text-[28px] text-choc">{displayPrice(currency)}</p>
            </div>

            <PaymentMethodSelector
              currency={currency}
              amount={paymentAmount(currency)}
              selected={gateway}
              onSelect={(g) => {
                setGateway(g);
                if (g !== "BANK_TRANSFER") setReceiptUrl(null);
              }}
              receiptUrl={receiptUrl}
              onReceiptUploaded={setReceiptUrl}
              guestEmail={clientEmail}
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
