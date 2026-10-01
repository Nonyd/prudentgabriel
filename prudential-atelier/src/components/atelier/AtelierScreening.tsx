"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ENQUIRY_OCCASIONS, OCCASION_DETAILS_KEY } from "@/lib/consultation-enquiry-shared";

/**
 * The first question on the atelier landing page, ahead of the enquiry form:
 * what the dress is for, and when. Nothing is sent from here; the answers carry
 * into the form at /consultation, where she adds her details.
 */
export function AtelierScreening({ headline, buttonLabel }: { headline: string; buttonLabel: string }) {
  const router = useRouter();
  const [occasion, setOccasion] = useState("");
  const [details, setDetails] = useState("");
  const [eventDate, setEventDate] = useState("");

  function next() {
    const q = new URLSearchParams();
    if (occasion) q.set("occasion", occasion);
    if (eventDate) q.set("date", eventDate);
    try {
      if (occasion === "OTHER" && details.trim()) sessionStorage.setItem(OCCASION_DETAILS_KEY, details.trim());
      else sessionStorage.removeItem(OCCASION_DETAILS_KEY);
    } catch {
      /* storage blocked: she types it again on the form */
    }
    const qs = q.toString();
    router.push(`/consultation${qs ? `?${qs}` : ""}`);
  }

  const label = "font-sans text-[11px] uppercase tracking-[0.12em] text-text-mid";

  return (
    <section className="px-6 py-16 lg:px-10">
      <div className="glass-2 glass-panel mx-auto max-w-xl px-8 py-10">
        <h2 className="text-center" style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: "var(--choc)" }}>
          {headline}
        </h2>
        <p className="mt-2 text-center font-body text-sm text-text-mid">Two questions first, then your details.</p>

        <div className="mt-8 space-y-6">
          <fieldset>
            <legend className={label}>Type of event</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {ENQUIRY_OCCASIONS.map((o) => (
                <label
                  key={o.id}
                  className={clsx(
                    "flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 transition-colors",
                    occasion === o.id ? "border-choc bg-choc/5" : "border-sand",
                  )}
                >
                  <input
                    type="radio"
                    name="atelier-occasion"
                    value={o.id}
                    checked={occasion === o.id}
                    onChange={() => setOccasion(o.id)}
                    className="accent-choc"
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
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
              />
            </label>
          ) : null}
          <label className="block">
            <span className={label}>Date of event</span>
            <input type="date" className="input-field mt-2 w-full" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </label>
        </div>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={next}
            disabled={!occasion || (occasion === "OTHER" && details.trim().length < 3)}
            className="btn-ghost-light inline-block disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buttonLabel} →
          </button>
        </div>
      </div>
    </section>
  );
}
