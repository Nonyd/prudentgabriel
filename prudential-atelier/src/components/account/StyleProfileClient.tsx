"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { ClientProfile } from "@prisma/client";
import { ProductCardGrid } from "@/components/common/ProductCardGrid";
import type { ProductListItem } from "@/types/product";
import { styleProfileComplete } from "@/lib/account-helpers";

const SILHOUETTES = ["A-line", "Fitted", "Flowy", "Structured", "Wrap", "Oversized"];
const COLORS = ["Neutrals", "Earth tones", "Bold & Bright", "Pastels", "Monochrome", "Metallics"];
const OCCASIONS = ["Work", "Events", "Church", "Casual", "Bridal", "Black tie"];
const BUDGETS = ["₦50k–₦150k", "₦150k–₦350k", "₦350k–₦750k", "₦750k+"];

export function StyleProfileClient({
  profile,
  picks,
}: {
  profile: ClientProfile;
  picks: ProductListItem[];
}) {
  const [step, setStep] = useState(0);
  const [silhouettes, setSilhouettes] = useState<string[]>(profile.preferredSilhouettes);
  const [colors, setColors] = useState<string[]>(profile.preferredColors);
  const [occasions, setOccasions] = useState<string[]>(profile.occasions);
  const [budget, setBudget] = useState(profile.budgetRange ?? "");
  const [dob, setDob] = useState(
    profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().slice(0, 10) : "",
  );
  const [editing, setEditing] = useState(!styleProfileComplete(profile));
  const [saving, setSaving] = useState(false);

  function toggle(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile/merged", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredSilhouettes: silhouettes,
          preferredColors: colors,
          occasions,
          budgetRange: budget || null,
          dateOfBirth: dob || null,
        }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      toast.success("Your style profile is saved");
    } catch {
      toast.error("Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-4xl text-choc">Style Profile</h1>
          <button type="button" onClick={() => setEditing(true)} className="btn-ghost-light">
            Edit Profile
          </button>
        </div>
        <div className="mt-8 space-y-6">
          {[
            ["Silhouettes", profile.preferredSilhouettes],
            ["Colours", profile.preferredColors],
            ["Occasions", profile.occasions],
          ].map(([label, chips]) =>
            (chips as string[]).length ? (
              <div key={label as string}>
                <p className="font-sans text-xs uppercase text-text-light">{label}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(chips as string[]).map((c) => (
                    <span key={c} className="rounded-sm border border-sand px-3 py-1 font-sans text-sm text-choc">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ) : null,
          )}
          {profile.budgetRange ? (
            <p className="font-sans text-sm text-text-mid">Budget: {profile.budgetRange}</p>
          ) : null}
        </div>
        <section className="mt-12">
          <h2 className="font-display text-2xl text-choc">Picked for you</h2>
          <ProductCardGrid
            products={picks}
            mobileColumns={1}
            className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          />
          <Link href="/shop" className="btn-primary mt-8 inline-flex">
            Browse the full collection
          </Link>
        </section>
      </div>
    );
  }

  const steps = [
    {
      title: "What silhouettes do you love?",
      options: SILHOUETTES,
      selected: silhouettes,
      set: setSilhouettes,
    },
    {
      title: "Your colour palette",
      options: COLORS,
      selected: colors,
      set: setColors,
    },
    {
      title: "What occasions do you dress for?",
      options: OCCASIONS,
      selected: occasions,
      set: setOccasions,
    },
  ];

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-4xl text-choc">Style Profile</h1>
      <div className="mt-4 h-1 bg-sand">
        <div
          className="h-full bg-nut transition-all"
          style={{ width: `${((step + 1) / 4) * 100}%` }}
        />
      </div>
      {step < 3 ? (
        <>
          <h2 className="mt-8 font-display text-xl text-choc">{steps[step]!.title}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {steps[step]!.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(steps[step]!.selected, opt, steps[step]!.set)}
                className={`rounded-sm border px-4 py-2 font-sans text-sm ${
                  steps[step]!.selected.includes(opt)
                    ? "border-nut bg-nut text-cream"
                    : "border-sand text-choc"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="mt-8 flex justify-between">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
              className="btn-ghost-light"
            >
              Back
            </button>
            <button type="button" onClick={() => setStep((s) => s + 1)} className="btn-primary">
              Next
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-8 font-display text-xl text-choc">Your typical budget range</h2>
          <div className="mt-4 space-y-2">
            {BUDGETS.map((b) => (
              <label key={b} className="flex items-center gap-3 font-sans text-sm">
                <input
                  type="radio"
                  name="budget"
                  checked={budget === b}
                  onChange={() => setBudget(b)}
                />
                {b}
              </label>
            ))}
          </div>
          <label className="mt-8 block font-sans text-sm text-choc">
            Birthday
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="mt-2 block w-full border border-sand bg-ivory px-3 py-2"
            />
          </label>
          <p className="mt-2 font-sans text-xs text-text-mid">Optional. 2,500 Prudent Points each year.</p>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-primary mt-8"
          >
            {saving ? "Saving…" : "Complete profile"}
          </button>
        </>
      )}
    </div>
  );
}
