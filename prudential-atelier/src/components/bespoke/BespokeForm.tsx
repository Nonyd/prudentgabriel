"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { motion } from "framer-motion";

const SOURCES = ["Instagram", "TikTok", "Referral", "Google", "Word of Mouth", "Other"];
const OCCASIONS = [
  "White Wedding",
  "Traditional Wedding",
  "Wedding Guest",
  "Corporate Event",
  "Birthday",
  "Naming Ceremony",
  "Graduation",
  "Other",
];
const BUDGETS = ["Under ₦200k", "₦200k–₦500k", "₦500k–₦1M", "Above ₦1M"];
const TIMELINES = ["Under 2 weeks", "2–4 weeks", "1–2 months", "3+ months"];

export function BespokeForm() {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: "NG",
    source: "Instagram",
    occasion: "",
    description: "",
    budgetRange: "",
    timeline: "",
    bust: "",
    waist: "",
    hips: "",
    height: "",
    mnotes: "",
    preferredDate: "",
    fee: false,
  });

  async function submit() {
    if (!form.fee) {
      toast.error("Please confirm the consultation fee.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bespoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          country: form.country,
          source: form.source,
          occasion: form.occasion,
          description: form.description,
          budgetRange: form.budgetRange,
          timeline: form.timeline,
          referenceImages: [],
          measurements: {
            bust: form.bust,
            waist: form.waist,
            hips: form.hips,
            height: form.height,
            notes: form.mnotes,
          },
          preferredDate: form.preferredDate || undefined,
          consultationFeeAccepted: form.fee,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ? "Invalid" : "Failed");
      setDone(j.requestNumber as string);
    } catch {
      toast.error("Could not submit request");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="py-16 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <p className="font-display text-3xl text-wine">Request received!</p>
          <p className="mt-2 font-label text-gold">#{done}</p>
          <p className="mt-4 text-sm text-charcoal-mid">Our team will contact you within 24–48 hours.</p>
          <Link href="/shop" className="mt-8 inline-block rounded-sm bg-wine px-6 py-2 text-ivory">
            Back to shop
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full bg-wine transition-all" style={{ width: `${(step / 3) * 100}%` }} />
      </div>
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-wine">About you</h2>
          <input className="w-full border-b border-border bg-transparent py-2" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full border-b border-border bg-transparent py-2" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="w-full border-b border-border bg-transparent py-2" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="w-full border-b border-border bg-transparent py-2" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
            <option value="NG">Nigeria</option>
            <option value="GB">United Kingdom</option>
            <option value="US">United States</option>
          </select>
          <select className="w-full border-b border-border bg-transparent py-2" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="button" className="w-full bg-wine py-2 text-ivory" onClick={() => setStep(2)}>
            Continue
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-wine">Your piece</h2>
          <select className="w-full border-b bg-transparent py-2" value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })}>
            <option value="">Occasion</option>
            {OCCASIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <textarea className="min-h-[120px] w-full rounded-sm border border-border p-3" placeholder="Describe your dream piece (min 20 characters)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="w-full border-b bg-transparent py-2" value={form.budgetRange} onChange={(e) => setForm({ ...form, budgetRange: e.target.value })}>
            <option value="">Budget range</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select className="w-full border-b bg-transparent py-2" value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })}>
            <option value="">Timeline</option>
            {TIMELINES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex gap-3">
            <button type="button" className="flex-1 border py-2" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="flex-1 bg-wine py-2 text-ivory" onClick={() => setStep(3)}>
              Continue
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-wine">Measurements (optional)</h2>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Bust cm" className="border-b bg-transparent py-2" value={form.bust} onChange={(e) => setForm({ ...form, bust: e.target.value })} />
            <input placeholder="Waist cm" className="border-b bg-transparent py-2" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} />
            <input placeholder="Hips cm" className="border-b bg-transparent py-2" value={form.hips} onChange={(e) => setForm({ ...form, hips: e.target.value })} />
            <input placeholder="Height cm" className="border-b bg-transparent py-2" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
          </div>
          <textarea className="w-full rounded-sm border p-3" placeholder="Additional notes" value={form.mnotes} onChange={(e) => setForm({ ...form, mnotes: e.target.value })} />
          <input type="date" className="w-full border-b bg-transparent py-2" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} />
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.checked })} />I agree to a consultation fee of ₦10,000 (refundable on order)
          </label>
          <div className="flex gap-3">
            <button type="button" className="flex-1 border py-2" onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" disabled={busy} className="flex-1 bg-wine py-2 text-ivory disabled:opacity-50" onClick={submit}>
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
