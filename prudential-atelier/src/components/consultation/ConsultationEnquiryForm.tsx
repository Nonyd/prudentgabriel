"use client";

import { useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  ENQUIRY_EVENT_TYPES,
  ENQUIRY_OUTFIT_TYPES,
  ENQUIRY_WEARERS,
} from "@/lib/consultation-enquiry-shared";
import { getWatYmd } from "@/lib/consultation";
import { cmsGet } from "@/lib/cms-helpers";

const MAX_IMAGES = 5;

/**
 * BA2: the atelier application. Nothing is booked or paid here; the house
 * reads it, and an approved enquiry receives a booking link by email.
 */
export function ConsultationEnquiryForm({ cms = {} }: { cms?: Record<string, string> }) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState("");
  const [wearer, setWearer] = useState("");
  const [outfitType, setOutfitType] = useState("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ enquiryNumber: string; shortNotice: boolean } | null>(null);
  const today = getWatYmd();

  const valid =
    clientName.trim().length >= 2 &&
    clientEmail.includes("@") &&
    clientPhone.trim().length >= 7 &&
    Boolean(eventDate && eventType && wearer && outfitType);

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
          clientName,
          clientEmail,
          clientPhone,
          eventDate,
          eventType,
          wearer,
          outfitType,
          notes: notes || undefined,
          moodboardImages: images,
        }),
      });
      const j = (await res.json()) as { enquiryNumber?: string; shortNotice?: boolean; error?: unknown };
      if (!res.ok || !j.enquiryNumber) {
        throw new Error(typeof j.error === "string" ? j.error : "Please check the form and try again.");
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

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-8">
      <section className="space-y-5 glass-opaque p-6">
        <h2 className="font-serif text-xl text-choc">
          {cmsGet(cms, "consultation_enquiry_screening_title", "A few questions first")}
        </h2>
        <div>
          <p className={label}>Who will wear it?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {ENQUIRY_WEARERS.map((w) => (
              <label
                key={w.id}
                className={clsx(
                  "flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 transition-colors",
                  wearer === w.id ? "border-choc bg-choc/5" : "border-sand",
                )}
              >
                <input
                  type="radio"
                  name="wearer"
                  value={w.id}
                  checked={wearer === w.id}
                  onChange={() => setWearer(w.id)}
                  className="accent-choc"
                  required
                />
                <span className="font-body text-sm text-text-mid">{w.label}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="block">
          <span className={label}>What kind of outfit?</span>
          <select className="input-field mt-2 w-full" value={outfitType} onChange={(e) => setOutfitType(e.target.value)} required>
            <option value="">Select…</option>
            {ENQUIRY_OUTFIT_TYPES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={label}>The occasion</span>
            <select className="input-field mt-2 w-full" value={eventType} onChange={(e) => setEventType(e.target.value)} required>
              <option value="">Select…</option>
              {ENQUIRY_EVENT_TYPES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Event date</span>
            <input
              type="date"
              min={today}
              className="input-field mt-2 w-full"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </label>
        </div>
      </section>

      <section className="space-y-5 glass-opaque p-6">
        <h2 className="font-serif text-xl text-choc">Your details</h2>
        <label className="block">
          <span className={label}>Full name</span>
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
      </section>

      <section className="space-y-5 glass-opaque p-6">
        <h2 className="font-serif text-xl text-choc">Inspiration (optional)</h2>
        <label className="block">
          <span className={label}>Tell us about it</span>
          <textarea
            className="input-field mt-2 min-h-[120px] w-full"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
          />
        </label>
        <div>
          <p className={label}>Moodboard or inspiration pictures (up to {MAX_IMAGES})</p>
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
