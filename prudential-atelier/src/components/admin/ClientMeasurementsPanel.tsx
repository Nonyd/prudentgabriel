"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import type { MeasurementData } from "@/lib/measurements";

export type { MeasurementData } from "@/lib/measurements";

type MeasurementFieldKey =
  | "bust"
  | "waist"
  | "hips"
  | "shoulderWidth"
  | "sleeveLength"
  | "dressLength"
  | "thigh"
  | "inseam"
  | "neck"
  | "armhole";

const FIELDS: { key: MeasurementFieldKey; label: string }[] = [
  { key: "bust", label: "Bust" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "shoulderWidth", label: "Shoulder" },
  { key: "sleeveLength", label: "Sleeve" },
  { key: "dressLength", label: "Dress Length" },
  { key: "thigh", label: "Thigh" },
  { key: "inseam", label: "Inseam" },
  { key: "neck", label: "Neck" },
  { key: "armhole", label: "Armhole" },
];

function emptyForm(unit: "inches" | "cm"): MeasurementData {
  return {
    bust: null,
    waist: null,
    hips: null,
    shoulderWidth: null,
    sleeveLength: null,
    dressLength: null,
    thigh: null,
    inseam: null,
    neck: null,
    armhole: null,
    unit,
    notes: "",
  };
}

export async function patchClientMeasurements(clientId: string, form: MeasurementData) {
  const unit = form.unit === "cm" ? "cm" : "inches";
  const res = await fetch(`/api/clients/${clientId}/measurements`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...form, unit }),
  });
  const j = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Save failed");
}

export function ClientMeasurementsPanel({
  clientId,
  clientName,
  initial,
  compact = false,
  onSaved,
  onDraftChange,
}: {
  clientId: string | null;
  clientName: string;
  initial?: MeasurementData | null;
  compact?: boolean;
  onSaved?: () => void;
  onDraftChange?: (draft: MeasurementData | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unit, setUnit] = useState<"inches" | "cm">(
    initial?.unit === "cm" ? "cm" : "inches",
  );
  const [form, setForm] = useState<MeasurementData>(initial ?? emptyForm("inches"));

  useEffect(() => {
    if (!onDraftChange || !clientId) return;
    const hasValues = FIELDS.some((f) => form[f.key] != null);
    onDraftChange(hasValues ? { ...form, unit } : null);
  }, [clientId, form, onDraftChange, unit]);

  if (!clientId) {
    return (
      <section className={compact ? "mt-4" : "card-surface p-6"}>
        <h2 className="panel-title font-sans font-semibold uppercase text-text-light">Client Measurements</h2>
        <p className="mt-3 font-sans text-sm text-text-mid">
          No linked client profile for this booking. Measurements can be saved once the client has an account.
        </p>
      </section>
    );
  }

  const hasData = FIELDS.some((f) => form[f.key] != null);
  const unitLabel = unit === "cm" ? "cm" : '"';

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/measurements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, unit }),
      });
      const j = (await res.json()) as { error?: string; item?: MeasurementData };
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      if (j.item) setForm(j.item);
      toast.success(`Measurements saved to ${clientName}'s profile`);
      setEditing(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save measurements");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={compact ? "mt-4 rounded border border-sand bg-ivory/50 p-4" : "card-surface p-6"}>
      <h2 className="panel-title font-sans font-semibold uppercase text-text-light">Client Measurements</h2>

      {!editing && hasData ? (
        <>
          {form.updatedAt ? (
            <p className="mt-2 font-sans text-xs text-text-light">
              Last updated: {formatDate(form.updatedAt)}
            </p>
          ) : null}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {FIELDS.filter((f) => form[f.key] != null).map((f) => (
              <div key={f.key}>
                <dt className="font-sans text-[11px] text-text-light">{f.label}</dt>
                <dd className="font-sans text-sm text-choc">
                  {form[f.key]}
                  {unitLabel}
                </dd>
              </div>
            ))}
          </dl>
          {form.notes ? (
            <p className="mt-3 whitespace-pre-wrap font-sans text-sm text-text-mid">{form.notes}</p>
          ) : null}
          <Button type="button" size="sm" variant="secondary" className="mt-4" onClick={() => setEditing(true)}>
            Edit Measurements
          </Button>
        </>
      ) : !editing ? (
        <>
          <p className="mt-3 font-sans text-sm text-text-mid">No measurements saved for this client.</p>
          <Button
            type="button"
            size="sm"
            className="mt-4"
            onClick={() => {
              setForm(initial ?? emptyForm(unit));
              setEditing(true);
            }}
          >
            Add Measurements
          </Button>
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <fieldset className="flex gap-4 font-sans text-sm text-text-mid">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`unit-${clientId}`}
                checked={unit === "inches"}
                onChange={() => setUnit("inches")}
              />
              Inches
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`unit-${clientId}`}
                checked={unit === "cm"}
                onChange={() => setUnit("cm")}
              />
              Centimetres
            </label>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="block font-sans text-xs text-text-mid">
                {f.label}
                <input
                  type="number"
                  step="0.1"
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      [f.key]: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="input-field mt-1"
                />
              </label>
            ))}
          </div>
          <label className="block font-sans text-xs text-text-mid">
            Notes
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="input-field mt-1"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save Measurements"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setForm(initial ?? emptyForm(unit));
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
