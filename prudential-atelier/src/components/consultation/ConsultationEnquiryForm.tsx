"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  ENQUIRY_FITTING_MODES,
  ENQUIRY_OCCASIONS,
  MAX_DRESSES,
  OCCASION_DETAILS_KEY,
} from "@/lib/consultation-enquiry-shared";
import { getWatYmd } from "@/lib/consultation";
import { cmsGet } from "@/lib/cms-helpers";

const MAX_IMAGES = 5;

/**
 * BA2: the atelier application, asking the house's questions (30 September
 * 2026). Nothing is booked or paid here; the house reads it, and an approved
 * enquiry receives a booking link by email.
 */
export type EnquiryPrefill = { occasion?: string; occasionDetails?: string; eventDate?: string };

/** The API answers 400 with zod's flattened errors; show the first one in words. */
function firstError(error: unknown): string | null {
  if (typeof error === "string") return error;
  const fields = (error as { fieldErrors?: Record<string, string[] | undefined> } | null)?.fieldErrors;
  if (!fields) return null;
  for (const messages of Object.values(fields)) if (messages?.[0]) return messages[0];
  return null;
}

export function ConsultationEnquiryForm({
  cms = {},
  initial = {},
}: {
  cms?: Record<string, string>;
  /** Answers carried from the atelier page's first question. */
  initial?: EnquiryPrefill;
}) {
  const [occasion, setOccasion] = useState(initial.occasion ?? "");
  const [occasionDetails, setOccasionDetails] = useState(initial.occasionDetails ?? "");
  const [eventDate, setEventDate] = useState(initial.eventDate ?? "");
  const [eventLocation, setEventLocation] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [presentCity, setPresentCity] = useState("");
  const [presentState, setPresentState] = useState("");
  const [presentCountry, setPresentCountry] = useState("");
  const [dressCount, setDressCount] = useState("1");
  const [fittingMode, setFittingMode] = useState("");
  const [fittingNote, setFittingNote] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [colourPalette, setColourPalette] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ enquiryNumber: string; shortNotice: boolean } | null>(null);
  const today = getWatYmd();

  // An "Other" description typed on the atelier page waits in session storage.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(OCCASION_DETAILS_KEY);
      if (saved && initial.occasion === "OTHER") setOccasionDetails((d) => d || saved);
    } catch {
      /* storage blocked: she types it here */
    }
  }, [initial.occasion]);

  const dresses = Number(dressCount);
  const valid =
    Boolean(occasion) &&
    (occasion !== "OTHER" || occasionDetails.trim().length >= 3) &&
    Boolean(eventDate) &&
    eventLocation.trim().length >= 2 &&
    clientName.trim().length >= 2 &&
    clientEmail.includes("@") &&
    clientPhone.trim().length >= 7 &&
    presentCity.trim().length >= 2 &&
    presentCountry.trim().length >= 2 &&
    Number.isInteger(dresses) &&
    dresses >= 1 &&
    dresses <= MAX_DRESSES &&
    Boolean(fittingMode) &&
    Boolean(deliveryDate) &&
    (!eventDate || deliveryDate <= eventDate);

  async function upload(file: File) {
    if (images.length >= MAX_IMAGES) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/consultations/upload", { method: "POST", body: fd });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error ?? "Upload failed");
      setImages((prev) => [...prev, j.url!]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/consultations/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion,
          occasionDetails: occasion === "OTHER" ? occasionDetails : undefined,
          clientName,
          clientEmail,
          clientPhone,
          dressCount: dresses,
          eventDate,
          eventLocation,
          presentCity,
          presentState: presentState || undefined,
          presentCountry,
          fittingMode,
          fittingNote: fittingNote || undefined,
          deliveryDate,
          colourPalette: colourPalette || undefined,
          moodboardImages: images,
        }),
      });
      const j = (await res.json()) as { enquiryNumber?: string; shortNotice?: boolean; error?: unknown };
      if (!res.ok || !j.enquiryNumber) {
        throw new Error(firstError(j.error) ?? "Please check the form and try again.");
      }
      setDone({ enquiryNumber: j.enquiryNumber, shortNotice: Boolean(j.shortNotice) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your enquiry");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl glass-2 glass-panel px-8 py-10 text-center" role="status">
        <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-lightbr">Enquiry {done.enquiryNumber}</p>
        <h2 className="mt-3 font-serif text-[30px] text-choc">Thank you. We have it.</h2>
        <p className="mt-4 font-body text-[15px] leading-relaxed text-text-mid">
          The atelier reads every enquiry and will reply by email. Nothing is booked or charged yet.
        </p>
        {done.shortNotice ? (
          <p className="mt-4 font-body text-[15px] leading-relaxed text-text-mid">
            Your date is close, so we will call you on the number you gave us to talk about an express commission.
          </p>
        ) : null}
      </div>
    );
  }

  const label = "font-sans text-[11px] uppercase tracking-[0.12em] text-text-mid";
  const hint = "mt-1 block font-body text-xs text-text-light";
  const choice = (on: boolean) =>
    clsx(
      "flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 transition-colors",
      on ? "border-choc bg-choc/5" : "border-sand",
    );

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-8">
      <section className="space-y-5 glass-opaque p-6">
        <h2 className="font-serif text-xl text-choc">
          {cmsGet(cms, "consultation_enquiry_screening_title", "The occasion")}
        </h2>
        <fieldset>
          <legend className={label}>Type of event</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {ENQUIRY_OCCASIONS.map((o) => (
              <label key={o.id} className={choice(occasion === o.id)}>
                <input
                  type="radio"
                  name="occasion"
                  value={o.id}
                  checked={occasion === o.id}
                  onChange={() => setOccasion(o.id)}
                  className="accent-choc"
                  required
                />
                <span className="font-body text-sm text-text-mid">{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {occasion === "OTHER" ? (
          <label className="block">
            <span className={label}>Tell us about the occasion</span>
            <textarea
              className="input-field mt-2 min-h-[96px] w-full"
              value={occasionDetails}
              onChange={(e) => setOccasionDetails(e.target.value)}
              maxLength={1000}
              required
            />
          </label>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Date of event</span>
            <input
              type="date"
              min={today}
              className="input-field mt-2 w-full"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className={label}>Location of event</span>
            <input
              className="input-field mt-2 w-full"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              placeholder="City, or the venue"
              maxLength={200}
              required
            />
          </label>
        </div>
      </section>

      <section className="space-y-5 glass-opaque p-6">
        <h2 className="font-serif text-xl text-choc">Your details</h2>
        <label className="block">
          <span className={label}>Name</span>
          <input className="input-field mt-2 w-full" value={clientName} onChange={(e) => setClientName(e.target.value)} autoComplete="name" required />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Email</span>
            <input
              type="email"
              className="input-field mt-2 w-full"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="block">
            <span className={label}>Phone</span>
            <input className="input-field mt-2 w-full" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} autoComplete="tel" required />
          </label>
        </div>
        <fieldset>
          <legend className={label}>Where you live now</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <input
              className="input-field w-full"
              aria-label="City"
              placeholder="City"
              value={presentCity}
              onChange={(e) => setPresentCity(e.target.value)}
              autoComplete="address-level2"
              maxLength={100}
              required
            />
            <input
              className="input-field w-full"
              aria-label="State or region (optional)"
              placeholder="State or region"
              value={presentState}
              onChange={(e) => setPresentState(e.target.value)}
              autoComplete="address-level1"
              maxLength={100}
            />
            <input
              className="input-field w-full"
              aria-label="Country"
              placeholder="Country"
              value={presentCountry}
              onChange={(e) => setPresentCountry(e.target.value)}
              autoComplete="country-name"
              maxLength={100}
              required
            />
          </div>
        </fieldset>
      </section>

      <section className="space-y-5 glass-opaque p-6">
        <h2 className="font-serif text-xl text-choc">Your dresses</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Number of dresses</span>
            <input
              type="number"
              min={1}
              max={MAX_DRESSES}
              step={1}
              className="input-field mt-2 w-full"
              value={dressCount}
              onChange={(e) => setDressCount(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className={label}>Delivery date</span>
            <input
              type="date"
              min={today}
              max={eventDate || undefined}
              className="input-field mt-2 w-full"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              required
            />
            <span className={hint}>When you need the dress. On or before the event.</span>
          </label>
        </div>
        <fieldset>
          <legend className={label}>Fitting availability</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {ENQUIRY_FITTING_MODES.map((m) => (
              <label key={m.id} className={choice(fittingMode === m.id)}>
                <input
                  type="radio"
                  name="fittingMode"
                  value={m.id}
                  checked={fittingMode === m.id}
                  onChange={() => setFittingMode(m.id)}
                  className="accent-choc"
                  required
                />
                <span className="font-body text-sm text-text-mid">{m.label}</span>
              </label>
            ))}
          </div>
          <input
            className="input-field mt-3 w-full"
            aria-label="When you are available for fittings (optional)"
            placeholder="When you are available (optional), e.g. weekends in Lagos until December"
            value={fittingNote}
            onChange={(e) => setFittingNote(e.target.value)}
            maxLength={500}
          />
        </fieldset>
        <label className="block">
          <span className={label}>Colour palette (optional)</span>
          <input
            className="input-field mt-2 w-full"
            value={colourPalette}
            onChange={(e) => setColourPalette(e.target.value)}
            placeholder="e.g. ivory and champagne gold, or not sure yet"
            maxLength={500}
          />
        </label>
        <div>
          <p className={label}>Pictorial inspiration (up to {MAX_IMAGES}, optional)</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-2 text-sm"
            disabled={uploading || images.length >= MAX_IMAGES}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          {images.length ? (
            <p className="mt-2 font-body text-xs text-text-light">
              {images.length} picture{images.length === 1 ? "" : "s"} added
              <button type="button" className="ml-3 underline" onClick={() => setImages([])}>
                Remove all
              </button>
            </p>
          ) : null}
        </div>
      </section>

      <div className="text-center">
        <button
          type="submit"
          disabled={!valid || submitting || uploading}
          className="rounded-sm bg-nut px-12 py-4 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-cream transition-colors hover:bg-choc disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send enquiry"}
        </button>
        <p className="mx-auto mt-4 max-w-md font-body text-xs leading-relaxed text-text-light">
          Nothing is booked or charged yet. If the house can take your commission, we email you a link to choose a
          consultation and propose dates.
        </p>
      </div>
    </form>
  );
}
