"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import clsx from "clsx";
import { Calendar, Check, Clock, Home, MapPin, Phone, Video } from "lucide-react";
import toast from "react-hot-toast";
import type { ConsultantWithOfferings } from "@/lib/consultation";
import {
  addDaysToWatYmd,
  getDeliveryModeLabel,
  getSessionTypeLabel,
  getWatYmd,
  isManualFlow,
  isVirtualDelivery,
} from "@/lib/consultation";
import type { ConsultantOffering, ConsultationDeliveryMode, ConsultationSessionType, Currency } from "@prisma/client";
import { StripePayBlock } from "@/components/checkout/StripePayBlock";
type Gateway = "PAYSTACK" | "FLUTTERWAVE" | "STRIPE" | "MONNIFY";
type ShopCur = "NGN" | "USD" | "GBP";

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

const SESSION_ICONS: Partial<Record<ConsultationSessionType, string>> = {
  BESPOKE_DESIGN: "✂️",
  BRIDAL_CONSULTATION: "💍",
  STYLING_SESSION: "👗",
  WARDROBE_CONSULTATION: "🪞",
  GROUP_SESSION: "👥",
  DISCOVERY_CALL: "🌟",
};

function deliveryIcon(mode: ConsultationDeliveryMode) {
  if (mode.includes("VIRTUAL") || mode === "PHONE_CALL") return Video;
  if (mode.includes("HOME")) return Home;
  if (mode.includes("INPERSON")) return MapPin;
  return Phone;
}

export function ConsultationBookingFlow({ consultants }: { consultants: ConsultantWithOfferings[] }) {
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [consultant, setConsultant] = useState<ConsultantWithOfferings | null>(null);
  const [offering, setOffering] = useState<ConsultantOffering | null>(null);
  const [sessionType, setSessionType] = useState<ConsultationSessionType | null>(null);
  const [manualFlow, setManualFlow] = useState(false);

  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [pref1, setPref1] = useState("");
  const [pref2, setPref2] = useState("");
  const [pref3, setPref3] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCountry, setClientCountry] = useState("NG");
  const [clientInstagram, setClientInstagram] = useState("");
  const [occasion, setOccasion] = useState("");
  const [description, setDescription] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [currency, setCurrency] = useState<ShopCur>("NGN");
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

  const sessionTypesForConsultant = useMemo(() => {
    if (!consultant) return [];
    const set = new Set<ConsultationSessionType>();
    consultant.offerings.forEach((o) => set.add(o.sessionType));
    return Array.from(set);
  }, [consultant]);

  const offeringsForSession = useMemo(() => {
    if (!consultant || !sessionType) return [];
    return consultant.offerings.filter((o) => o.sessionType === sessionType);
  }, [consultant, sessionType]);

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

  function selectConsultant(c: ConsultantWithOfferings) {
    setConsultant(c);
    setOffering(null);
    setSessionType(null);
    setManualFlow(c.isFlagship);
  }

  function pickOffering(o: ConsultantOffering) {
    setOffering(o);
    setManualFlow(isManualFlow(o.deliveryMode, consultant?.isFlagship ?? false));
  }

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
        description,
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    }
    setSubmitting(false);
  }

  const stepValid =
    step === 1
      ? Boolean(consultant && offering)
      : step === 2
        ? manualFlow
          ? Boolean(pref1)
          : Boolean(selectedYmd && selectedTime)
        : step === 3
          ? clientName.length >= 2 &&
            clientEmail.includes("@") &&
            clientPhone.length >= 7 &&
            occasion &&
            description.length >= 20
          : Boolean(gateway);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-10 flex items-center justify-between gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex flex-1 items-center">
            <div
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium",
                step > n && "border-wine bg-wine text-ivory",
                step === n && "border-gold text-wine shadow-[0_0_12px_rgba(201,168,76,0.4)]",
                step < n && "border-border text-charcoal-mid",
              )}
            >
              {step > n ? <Check className="h-4 w-4" /> : n}
            </div>
            {n < 4 && (
              <div
                className={clsx("mx-1 hidden h-0.5 flex-1 sm:block", step > n ? "bg-wine" : "bg-border")}
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="font-display text-2xl text-charcoal">Who would you like to consult with?</h2>
          <p className="mt-2 text-sm text-charcoal-mid">Each consultant brings a different level of expertise.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {consultants.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectConsultant(c)}
                className={clsx(
                  "border bg-canvas p-8 text-left transition-colors",
                  consultant?.id === c.id ? "border-2 border-olive bg-off-white" : "border-mid-grey hover:border-olive/50",
                )}
              >
                <div className="flex gap-4">
                  {c.image ? (
                    <Image src={c.image} alt="" width={80} height={80} className="h-20 w-20 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded-full bg-mid-grey" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[22px] font-medium text-charcoal">{c.name}</p>
                    <p className="mt-1 font-body text-[11px] font-medium uppercase tracking-[0.15em] text-olive">{c.title}</p>
                    {c.isFlagship && (
                      <span className="mt-2 inline-block border border-olive px-2.5 py-0.5 font-body text-[9px] font-medium uppercase tracking-[0.08em] text-olive">
                        Flagship · By Appointment
                      </span>
                    )}
                    <p className="mt-2 line-clamp-4 font-body text-[13px] font-light leading-relaxed text-dark-grey">{c.bio}</p>
                    <p className="mt-3 font-display text-[20px] text-charcoal">
                      From ₦{Math.min(...c.offerings.map((o) => o.feeNGN)).toLocaleString("en-NG")}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {consultant && (
            <div className="mt-10 space-y-6">
              <div>
                <p className="mb-3 font-label text-[11px] uppercase tracking-wider text-gold">
                  What would you like to focus on?
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sessionTypesForConsultant.map((st) => {
                    const stKey = st as ConsultationSessionType;
                    return (
                    <button
                      key={stKey}
                      type="button"
                      onClick={() => {
                        setSessionType(stKey);
                        setOffering(null);
                      }}
                      className={clsx(
                        "rounded-sm border p-3 text-left text-sm",
                        sessionType === stKey ? "border-wine bg-wine/5" : "border-border",
                      )}
                    >
                      <span className="mr-2">{SESSION_ICONS[stKey] ?? "•"}</span>
                      {getSessionTypeLabel(stKey)}
                    </button>
                  );
                  })}
                </div>
              </div>

              {sessionType && (
                <div>
                  <p className="mb-3 font-label text-[11px] uppercase tracking-wider text-gold">
                    How would you like to meet?
                  </p>
                  <div className="grid gap-2">
                    {offeringsForSession.map((o) => {
                      const Icon = deliveryIcon(o.deliveryMode);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => pickOffering(o)}
                          className={clsx(
                            "flex items-center justify-between gap-3 rounded-sm border p-3 text-left",
                            offering?.id === o.id ? "border-wine bg-wine/5" : "border-border",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-wine" />
                            <div>
                              <p className="text-sm font-medium text-charcoal">{getDeliveryModeLabel(o.deliveryMode)}</p>
                              <p className="text-xs text-charcoal-mid">{o.durationMinutes} minutes</p>
                            </div>
                          </div>
                          <p className="font-display text-wine">₦{o.feeNGN.toLocaleString("en-NG")}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!stepValid}
            onClick={() => setStep(2)}
            className="mt-10 w-full rounded-sm bg-wine py-3 text-sm font-medium text-ivory disabled:opacity-40"
          >
            Continue to schedule
          </button>
        </div>
      )}

      {step === 2 && consultant && offering && (
        <div>
          {manualFlow ? (
            <>
              <h2 className="font-display text-2xl text-charcoal">Submit your preferred dates</h2>
              <div className="mt-4 rounded-sm border border-gold/30 bg-wine/5 p-4 text-sm text-charcoal">
                As Mrs. Gabriel-Okopi personally conducts these sessions, scheduling is coordinated with her team.
                Submit up to three preferred dates; we will confirm within 24–48 hours.
              </div>
              <div className="mt-6 space-y-4">
                <label className="block text-sm">
                  <span className="text-charcoal-mid">1st preference (required)</span>
                  <input
                    type="date"
                    min={minManualDate}
                    value={pref1}
                    onChange={(e) => setPref1(e.target.value)}
                    className="mt-1 w-full rounded-sm border border-border bg-ivory px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-charcoal-mid">2nd preference</span>
                  <input
                    type="date"
                    min={minManualDate}
                    value={pref2}
                    onChange={(e) => setPref2(e.target.value)}
                    className="mt-1 w-full rounded-sm border border-border bg-ivory px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-charcoal-mid">3rd preference</span>
                  <input
                    type="date"
                    min={minManualDate}
                    value={pref3}
                    onChange={(e) => setPref3(e.target.value)}
                    className="mt-1 w-full rounded-sm border border-border bg-ivory px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl text-charcoal">Select date & time</h2>
              <p className="mt-2 text-sm text-charcoal-mid">All times are West Africa Time (WAT · UTC+1)</p>
              <div className="mt-6">
                <p className="font-label text-[11px] uppercase text-gold">Pick a date</p>
                {calLoading && step === 2 ? (
                  <p className="mt-2 text-sm text-charcoal-mid">Loading…</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableDates.slice(0, 20).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSelectedYmd(d);
                          setSelectedTime(null);
                        }}
                        className={clsx(
                          "rounded-sm border px-3 py-2 text-xs",
                          selectedYmd === d ? "border-wine bg-wine text-ivory" : "border-border",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedYmd && (
                <div className="mt-6">
                  <p className="font-label text-[11px] uppercase text-gold">Available times</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slots.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTime(t)}
                        className={clsx(
                          "rounded-sm border px-3 py-2 text-xs",
                          selectedTime === t ? "border-wine bg-wine text-ivory" : "border-border",
                        )}
                      >
                        {t} WAT
                      </button>
                    ))}
                  </div>
                  {!slots.length && <p className="mt-2 text-sm text-charcoal-mid">No times on this date.</p>}
                </div>
              )}
            </>
          )}
          <div className="mt-10 flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="rounded-sm border border-border px-4 py-2 text-sm">
              Back
            </button>
            <button
              type="button"
              disabled={!stepValid}
              onClick={() => setStep(3)}
              className="flex-1 rounded-sm bg-wine py-3 text-sm font-medium text-ivory disabled:opacity-40"
            >
              Continue to details
            </button>
          </div>
        </div>
      )}

      {step === 3 && consultant && offering && (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="font-display text-2xl text-charcoal lg:col-span-2">Your details</h2>
            <input
              placeholder="Full name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-sm border border-border bg-ivory px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="Email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full rounded-sm border border-border bg-ivory px-3 py-2 text-sm"
            />
            <input
              placeholder="Phone"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="w-full rounded-sm border border-border bg-ivory px-3 py-2 text-sm"
            />
            <label className="block text-sm">
              <span className="text-charcoal-mid">Country</span>
              <select
                className="mt-1 w-full rounded-sm border border-border bg-ivory px-3 py-2 text-sm"
                value={clientCountry}
                onChange={(e) => setClientCountry(e.target.value)}
              >
                <option value="NG">Nigeria</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="GH">Ghana</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <input
              placeholder="@instagram (optional)"
              value={clientInstagram}
              onChange={(e) => setClientInstagram(e.target.value)}
              className="w-full rounded-sm border border-border bg-ivory px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="text-charcoal-mid">Occasion</span>
              <select
                className="mt-1 w-full rounded-sm border border-border bg-ivory px-3 py-2 text-sm"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
              >
                <option value="">Select…</option>
                {OCCASIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-charcoal-mid">Tell us about your vision (min 20 characters)</span>
              <textarea
                className="mt-1 min-h-[140px] w-full rounded-sm border border-border bg-ivory px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
              />
              <span className="text-xs text-charcoal-mid">{description.length} / 2000</span>
            </label>
            <div>
              <p className="text-xs text-charcoal-mid">Reference images (optional, max 5)</p>
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
              <div className="mt-2 flex flex-wrap gap-2">
                {referenceImages.map((u) => (
                  <div key={u} className="relative h-16 w-16 overflow-hidden rounded-sm border">
                    <Image src={u} alt="" fill className="object-cover" />
                    <button
                      type="button"
                      className="absolute right-0 top-0 bg-charcoal/80 px-1 text-xs text-ivory"
                      onClick={() => setReferenceImages((p) => p.filter((x) => x !== u))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-sm border border-border bg-cream p-4 lg:col-span-2">
            <p className="font-display text-lg text-wine">Summary</p>
            <p className="text-sm text-charcoal">
              {consultant.name} · {getSessionTypeLabel(offering.sessionType)} · {getDeliveryModeLabel(offering.deliveryMode)}
            </p>
            <p className="mt-1 text-sm text-charcoal-mid">
              {!manualFlow && selectedYmd
                ? `${selectedYmd} at ${selectedTime ?? "—"} WAT`
                : manualFlow
                  ? "Preferred dates pending confirmation"
                  : ""}
            </p>
            <p className="mt-2 font-display text-wine">₦{offering.feeNGN.toLocaleString("en-NG")}</p>
          </div>
          <div className="flex gap-3 lg:col-span-2">
            <button type="button" onClick={() => setStep(2)} className="rounded-sm border border-border px-4 py-2 text-sm">
              Back
            </button>
            <button
              type="button"
              disabled={!stepValid}
              onClick={() => setStep(4)}
              className="flex-1 rounded-sm bg-wine py-3 text-sm font-medium text-ivory disabled:opacity-40"
            >
              Continue to payment
            </button>
          </div>
        </div>
      )}

      {step === 4 && consultant && offering && (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-sm border border-border bg-cream p-6">
            <p className="font-display text-xl text-wine">Booking summary</p>
            <p className="mt-4 text-sm text-charcoal">
              {consultant.name} — {getSessionTypeLabel(offering.sessionType)}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-charcoal-mid">
              {isVirtualDelivery(offering.deliveryMode) ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              {getDeliveryModeLabel(offering.deliveryMode)}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-charcoal-mid">
              <Clock className="h-4 w-4" />
              {offering.durationMinutes} minutes
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-charcoal-mid">
              <Calendar className="h-4 w-4" />
              {!manualFlow && selectedYmd
                ? `${selectedYmd} ${selectedTime ?? ""} WAT`
                : "Pending confirmation"}
            </p>
            <p className="mt-4 text-2xl font-medium text-wine">₦{offering.feeNGN.toLocaleString("en-NG")}</p>
          </div>
          <div className="space-y-4">
            <p className="font-label text-[11px] uppercase text-gold">Currency</p>
            <div className="flex gap-2">
              {(["NGN", "USD", "GBP"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCurrency(c);
                    setGateway(null);
                  }}
                  className={clsx(
                    "rounded-sm border px-3 py-2 text-xs",
                    currency === c ? "border-wine bg-wine/10" : "border-border",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="font-label text-[11px] uppercase text-gold">Payment method</p>
            <div className="space-y-2">
              {currency === "NGN" && (
                <>
                  <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-border p-3 text-sm">
                    <input type="radio" name="gw" checked={gateway === "PAYSTACK"} onChange={() => setGateway("PAYSTACK")} />
                    Paystack
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-border p-3 text-sm">
                    <input type="radio" name="gw" checked={gateway === "MONNIFY"} onChange={() => setGateway("MONNIFY")} />
                    Monnify
                  </label>
                </>
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-border p-3 text-sm">
                <input type="radio" name="gw" checked={gateway === "FLUTTERWAVE"} onChange={() => setGateway("FLUTTERWAVE")} />
                Flutterwave
              </label>
              {(currency === "USD" || currency === "GBP") && (
                <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-border p-3 text-sm">
                  <input type="radio" name="gw" checked={gateway === "STRIPE"} onChange={() => setGateway("STRIPE")} />
                  Stripe (card)
                </label>
              )}
            </div>
            {stripeClientSecret && stripePk ? (
              <StripePayBlock clientSecret={stripeClientSecret} publishableKey={stripePk} returnUrl={stripeReturnUrl} />
            ) : (
              <button
                type="button"
                disabled={!gateway || submitting}
                onClick={() => void pay()}
                className="w-full rounded-sm bg-wine py-3 text-sm font-medium text-ivory disabled:opacity-40"
              >
                {submitting ? "Please wait…" : "Confirm booking & pay"}
              </button>
            )}
            <button type="button" onClick={() => setStep(3)} className="w-full rounded-sm border border-border py-2 text-sm">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
