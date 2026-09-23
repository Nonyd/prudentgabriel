"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ENQUIRY_OUTFIT_TYPES, ENQUIRY_WEARERS } from "@/lib/consultation-enquiry-shared";

/**
 * BA4: the meeting's screening questions on the atelier landing page, ahead of
 * the enquiry form. Nothing is sent from here — the answers carry into the
 * form at /consultation, where she adds her details.
 */
export function AtelierScreening({ headline, buttonLabel }: { headline: string; buttonLabel: string }) {
  const router = useRouter();
  const [wearer, setWearer] = useState("");
  const [outfit, setOutfit] = useState("");
  const [eventDate, setEventDate] = useState("");

  function next() {
    const q = new URLSearchParams();
    if (wearer) q.set("wearer", wearer);
    if (outfit) q.set("outfit", outfit);
    if (eventDate) q.set("date", eventDate);
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
        <p className="mt-2 text-center font-body text-sm text-text-mid">Three questions first, then your details.</p>

        <div className="mt-8 space-y-6">
          <fieldset>
            <legend className={label}>Who will wear it?</legend>
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
                    name="atelier-wearer"
                    checked={wearer === w.id}
                    onChange={() => setWearer(w.id)}
                    className="accent-choc"
                  />
                  <span className="font-body text-sm text-text-mid">{w.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className={label}>What kind of outfit?</span>
            <select className="input-field mt-2 w-full" value={outfit} onChange={(e) => setOutfit(e.target.value)}>
              <option value="">Select…</option>
              {ENQUIRY_OUTFIT_TYPES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>When is the event?</span>
            <input type="date" className="input-field mt-2 w-full" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </label>
        </div>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={next}
            disabled={!wearer || !outfit}
            className="btn-ghost-light inline-block disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buttonLabel} →
          </button>
        </div>
      </div>
    </section>
  );
}
