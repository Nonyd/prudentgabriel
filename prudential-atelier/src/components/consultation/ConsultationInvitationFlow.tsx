"use client";

import { useMemo, useState } from "react";
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
  isOfferingTypeVirtual,
  OFFERING_TYPES,
  resolveOfferingType,
  VIRTUAL_PLATFORMS,
  type OfferingTypeKey,
  type VirtualPlatformId,
} from "@/lib/consultation-types";
import { consultationTermsText } from "@/lib/consultation-enquiry-shared";
import { StripePayBlock } from "@/components/checkout/StripePayBlock";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import type { PaymentGatewayType } from "@/lib/payments/index";
import { formatPrice } from "@/lib/currency";
import { cmsGet } from "@/lib/cms-helpers";
import { readHeldAttribution } from "@/lib/analytics/attribution";

type Gateway = PaymentGatewayType;
type ShopCur = "NGN" | "USD" | "GBP";

export type InvitationView = {
  token: string;
  enquiryNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  eventType: string;
  eventDateLabel: string;
};

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

function StepIndicator({ step }: { step: number }) {
  const steps = [
    { n: 1, label: "CHOOSE" },
    { n: 2, label: "PROPOSE DATES" },
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
            <div className={clsx("mx-4 mb-5 h-px w-12 sm:w-20", step > s.n ? "bg-choc" : "bg-sand")} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * BA2: the booking step, reached only from an approved enquiry's link. Every
 * type proposes three dates; the house confirms one against Mrs. Prudent's diary.
 */
export function ConsultationInvitationFlow({
  consultants,
  cms = {},
  invitation,
}: {
  consultants: ConsultantWithOfferings[];
  cms?: Record<string, string>;
  invitation: InvitationView;
}) {
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<OfferingTypeKey | null>(null);
  const [consultant, setConsultant] = useState<ConsultantWithOfferings | null>(null);
  const [offering, setOffering] = useState<ConsultantOffering | null>(null);
  const [pref1, setPref1] = useState("");
  const [pref2, setPref2] = useState("");
  const [pref3, setPref3] = useState("");
  const [virtualPlatform, setVirtualPlatform] = useState<VirtualPlatformId>("zoom");
  const [clientPhone, setClientPhone] = useState(invitation.clientPhone);
  const [description, setDescription] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [currency, setCurrency] = useState<ShopCur>("NGN");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingNumber, setBookingNumber] = useState<string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePk, setStripePk] = useState("");
  const minDate = useMemo(() => addDaysToWatYmd(getWatYmd(), 3), []);
  const paymentRef = useMemo(
    () => `PA-CONSULT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    [],
  );

  function selectType(key: OfferingTypeKey) {
    const cfg = getOfferingTypeConfig(key, cms);
    const resolved = cfg.enabled ? resolveOfferingType(consultants, key) : null;
    if (!resolved) {
      toast.error("This consultation type is not available right now.");
      return;
    }
    setSelectedType(key);
    setConsultant(resolved.consultant);
    setOffering(resolved.offering);
    setTermsAccepted(false);
  }

  const typeConfig = selectedType ? getOfferingTypeConfig(selectedType, cms) : null;
  const termsText = typeConfig ? consultationTermsText(typeConfig.priceNgn) : "";
  const datesDistinct = new Set([pref1, pref2, pref3]).size === 3;

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
      const body = {
        enquiryToken: invitation.token,
        termsAccepted: true,
        termsText,
        offeringId: offering.id,
        consultantId: consultant.id,
        offeringType: selectedType,
        virtualPlatform: selectedType && isOfferingTypeVirtual(selectedType) ? virtualPlatform : undefined,
        currency: currency as Currency,
        gateway,
        paymentRef: gateway === "BANK_TRANSFER" ? paymentRef : undefined,
        clientPhone,
        description: description || undefined,
        preferredDate1: prefYmdToDate(pref1),
        preferredDate2: prefYmdToDate(pref2),
        preferredDate3: prefYmdToDate(pref3),
        attribution: readHeldAttribution() ?? undefined,
      };

      const cr = await fetch("/api/consultations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const cj = (await cr.json()) as { bookingId?: string; bookingNumber?: string; error?: unknown };
      if (cr.status === 409) {
        throw new Error(typeof cj.error === "string" ? `${cj.error} Please reload the page.` : "Please reload the page.");
      }
      if (!cr.ok) throw new Error(typeof cj.error === "string" ? cj.error : "Could not create booking");
      const bid = cj.bookingId!;
      setBookingNumber(cj.bookingNumber!);

      const guestEmail = session?.user ? undefined : invitation.clientEmail;

      if (gateway === "STRIPE") {
        const pr = await fetch("/api/consultations/payment/stripe/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: bid, currency: currency === "GBP" ? "GBP" : "USD", guestEmail }),
        });
        const pj = await pr.json();
        if (!pr.ok) throw new Error((pj as { error?: string }).error ?? "Stripe failed");
        setStripeClientSecret((pj as { clientSecret: string }).clientSecret);
        setStripePk((pj as { publishableKey: string }).publishableKey ?? "");
        setSubmitting(false);
        return;
      }

      const initBody: Record<string, string> = { bookingId: bid };
      if (guestEmail) initBody.guestEmail = guestEmail;

      const redirectVia = async (path: string, extra: Record<string, string>, key: string) => {
        const pr = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...initBody, ...extra }),
        });
        const pj = (await pr.json()) as Record<string, string>;
        if (!pr.ok) throw new Error(pj.error ?? "Payment failed");
        window.location.href = pj[key];
      };

      if (gateway === "PAYSTACK") return await redirectVia("/api/consultations/payment/paystack/initiate", {}, "authorizationUrl");
      if (gateway === "FLUTTERWAVE") {
        return await redirectVia("/api/consultations/payment/flutterwave/initiate", { currency }, "paymentLink");
      }
      if (gateway === "MONNIFY") return await redirectVia("/api/consultations/payment/monnify/initiate", {}, "checkoutUrl");
      if (gateway === "BANK_TRANSFER") {
        if (!receiptUrl) throw new Error("Upload your payment receipt");
        return await redirectVia("/api/consultations/bank-transfer", { receiptUrl }, "redirectUrl");
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
        ? Boolean(pref1 && pref2 && pref3 && datesDistinct)
        : clientPhone.length >= 7 &&
          termsAccepted &&
          Boolean(gateway) &&
          (gateway !== "BANK_TRANSFER" || Boolean(receiptUrl));

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

  const dateInput = (label: string, value: string, set: (v: string) => void) => (
    <label className="block text-sm">
      <span className="font-sans text-text-mid">{label}</span>
      <input
        type="date"
        min={minDate}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="input-field mt-1 w-full"
        required
      />
    </label>
  );

  return (
    <div className="px-4 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-lightbr">
            Invitation {invitation.enquiryNumber}
          </p>
          <h1 className="mt-3 font-serif text-[40px] font-normal leading-tight text-choc md:text-[52px]">
            Book your consultation
          </h1>
          <p className="mx-auto mt-4 max-w-[520px] font-body text-[15px] leading-relaxed text-text-mid">
            For {invitation.clientName.split(/\s+/)[0]}&apos;s {invitation.eventType.toLowerCase()} on{" "}
            {invitation.eventDateLabel}. Choose how you would like to meet, then propose three dates. We confirm one
            against Mrs. Prudent&apos;s diary.
          </p>
        </header>

        <StepIndicator step={step} />

        {step === 1 && (
          <div>
            <div className="grid gap-5 md:grid-cols-2">
              {OFFERING_TYPES.map((key) => {
                const cfg = getOfferingTypeConfig(key, cms);
                if (!cfg.enabled || !resolveOfferingType(consultants, key)) return null;
                const selected = selectedType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectType(key)}
                    className={clsx(
                      "relative glass-2 glass-panel p-8 text-left",
                      selected
                        ? "border-[1.5px] border-choc shadow-[0_4px_24px_rgba(68,41,19,0.08)] transition-shadow"
                        : "border-[0.5px] border-sand transition-shadow hover:border-nut/40",
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
                      <p className="font-serif text-[28px] text-choc">{formatPrice(cfg.priceNgn, "NGN")}</p>
                      <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-text-light">
                        {selected ? "SELECTED" : "SELECT"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {showVirtualPlatform ? (
              <div className="mx-auto mt-8 max-w-xl glass-2 glass-panel p-6">
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
                  We email the meeting link when it is set, and again about an hour before you join.
                </p>
              </div>
            ) : null}

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
                Continue to dates →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto max-w-xl">
            <h2 className="text-center font-serif text-[32px] text-choc">Propose three dates</h2>
            <p className="mt-2 text-center font-body text-sm text-text-mid">
              Three different days, at least three days from today. We confirm one by email within 24–48 hours.
            </p>
            <div className="mt-8 space-y-4">
              {dateInput("First choice", pref1, setPref1)}
              {dateInput("Second choice", pref2, setPref2)}
              {dateInput("Third choice", pref3, setPref3)}
              {pref1 && pref2 && pref3 && !datesDistinct ? (
                <p className="font-body text-sm text-danger" role="alert">
                  Please choose three different days.
                </p>
              ) : null}
            </div>
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
            <div className="glass-opaque p-6">
              <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-lightbr">Booking summary</p>
              <h3 className="mt-2 font-serif text-xl text-choc">{typeConfig.title}</h3>
              <p className="mt-2 font-body text-sm text-text-mid">
                {[pref1, pref2, pref3].map(formatPrefYmd).join(" · ")}
              </p>
              {showVirtualPlatform ? (
                <p className="mt-1 font-body text-sm text-text-mid">Via {getVirtualPlatformLabel(virtualPlatform)}</p>
              ) : null}
              <p className="mt-4 font-serif text-[28px] text-choc">{displayPrice(currency)}</p>
            </div>

            <div className="space-y-4 glass-opaque p-6">
              <h3 className="font-serif text-xl text-choc">Your details</h3>
              <p className="font-body text-sm text-text-mid">
                {invitation.clientName} · {invitation.clientEmail}
              </p>
              <label className="block text-sm">
                <span className="font-sans text-text-mid">Phone</span>
                <input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="input-field mt-1 w-full"
                  autoComplete="tel"
                />
              </label>
              <label className="block text-sm">
                <span className="font-sans text-text-mid">Anything to add before we meet (optional)</span>
                <textarea
                  className="input-field mt-1 min-h-[100px] w-full"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                />
              </label>
            </div>

            <div className="glass-opaque p-6">
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

            <label className="flex cursor-pointer items-start gap-3 glass-opaque p-6">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 accent-choc"
              />
              <span className="font-body text-sm leading-relaxed text-text-mid">{termsText}</span>
            </label>

            <PaymentMethodSelector
              currency={currency}
              businessLine="ATELIER"
              amount={paymentAmount(currency)}
              paymentReference={paymentRef}
              selected={gateway}
              onSelect={(g) => {
                setGateway(g);
                if (g !== "BANK_TRANSFER") setReceiptUrl(null);
              }}
              receiptUrl={receiptUrl}
              onReceiptUploaded={setReceiptUrl}
              guestEmail={invitation.clientEmail}
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

        <p className="mt-12 text-center font-body text-xs text-text-light">
          {cmsGet(cms, "consultation_invitation_footer", "Questions? Reply to the email that brought you here.")}
        </p>
      </div>
    </div>
  );
}
