"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { Measurement } from "@prisma/client";

const FIELDS: { key: keyof Measurement; label: string }[] = [
  { key: "bust", label: "Bust" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "shoulderWidth", label: "Shoulder Width" },
  { key: "sleeveLength", label: "Sleeve Length" },
  { key: "dressLength", label: "Dress Length" },
  { key: "thigh", label: "Thigh" },
  { key: "inseam", label: "Inseam" },
  { key: "neck", label: "Neck" },
  { key: "armhole", label: "Armhole" },
];

function convert(val: number | null | undefined, unit: "inches" | "cm", displayUnit: "inches" | "cm") {
  if (val == null) return null;
  if (unit === displayUnit) return val;
  return displayUnit === "cm" ? Math.round(val * 2.54 * 10) / 10 : Math.round((val / 2.54) * 10) / 10;
}

export function MeasurementsClient({ initial }: { initial: Measurement | null }) {
  const [data, setData] = useState(initial);
  const [displayUnit, setDisplayUnit] = useState<"inches" | "cm">(
    (initial?.unit as "inches" | "cm") ?? "inches",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formUnit, setFormUnit] = useState<"inches" | "cm">("inches");
  const [saving, setSaving] = useState(false);

  const storedUnit = (data?.unit as "inches" | "cm") ?? "inches";

  function openModal() {
    const next: Record<string, string> = {};
    FIELDS.forEach(({ key }) => {
      const v = data?.[key];
      next[key] = v != null ? String(v) : "";
    });
    setForm(next);
    setFormUnit(storedUnit);
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { unit: formUnit };
      FIELDS.forEach(({ key }) => {
        const raw = form[key]?.trim();
        payload[key] = raw ? Number(raw) : null;
      });
      if (data?.notes) payload.notes = data.notes;

      const res = await fetch("/api/account/measurements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      const json = (await res.json()) as { measurements: Measurement };
      setData(json.measurements);
      setDisplayUnit(formUnit);
      setModalOpen(false);
      toast.success("Measurements updated");
    } catch {
      toast.error("Could not save measurements");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-choc">Your Measurements</h1>
          {data ? (
            <p className="mt-2 font-sans text-sm text-text-light">
              Last updated: {new Date(data.updatedAt).toLocaleDateString("en-GB")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDisplayUnit("inches")}
            className={`px-3 py-1 font-sans text-xs ${displayUnit === "inches" ? "bg-nut text-cream" : "border border-sand text-text-mid"}`}
          >
            Inches
          </button>
          <button
            type="button"
            onClick={() => setDisplayUnit("cm")}
            className={`px-3 py-1 font-sans text-xs ${displayUnit === "cm" ? "bg-nut text-cream" : "border border-sand text-text-mid"}`}
          >
            CM
          </button>
        </div>
      </div>

      {!data ? (
        <div className="mt-16 text-center">
          <p className="font-sans text-sm text-text-mid">
            Save your measurements securely for faster atelier commissions.
          </p>
          <button type="button" onClick={openModal} className="btn-primary mt-6">
            Add Your Measurements
          </button>
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {FIELDS.map(({ key, label }) => {
              const val = convert(data[key] as number | null, storedUnit, displayUnit);
              return (
                <div key={key} className="border border-sand/60 bg-ivory p-4 text-center">
                  <p className="font-display text-[32px] text-choc">{val ?? "—"}</p>
                  <p className="font-sans text-[10px] uppercase text-text-light">{displayUnit}</p>
                  <p className="mt-1 font-sans text-[11px] uppercase tracking-wider text-text-mid">{label}</p>
                </div>
              );
            })}
          </div>
          {data.notes ? (
            <p className="mt-6 font-sans text-sm text-text-mid">{data.notes}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={openModal} className="btn-ghost-light">
              Update Measurements
            </button>
            <a href="/api/account/measurements/pdf" className="btn-primary inline-flex">
              Download measurements
            </a>
          </div>
        </>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-ivory p-6">
            <h2 className="font-display text-2xl text-choc">Update Measurements</h2>
            <div className="mt-4 flex gap-2">
              {(["inches", "cm"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setFormUnit(u)}
                  className={`px-3 py-1 font-sans text-xs ${formUnit === u ? "bg-nut text-cream" : "border border-sand"}`}
                >
                  {u}
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {FIELDS.map(({ key, label }) => (
                <label key={key} className="block">
                  <span className="font-sans text-xs text-text-mid">{label}</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form[key] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1 w-full border border-sand bg-white px-3 py-2 font-sans text-sm"
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost-light">
                Cancel
              </button>
              <button type="button" onClick={save} disabled={saving} className="btn-primary">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
