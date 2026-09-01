"use client";

import { useMemo, useState } from "react";
import type { MeasurementFieldDef, TypedMeasurement } from "@/lib/custom-size";
import { CUSTOM_LEAD_COPY, CUSTOM_RETURNS_COPY } from "@/lib/custom-size";
import { fromCanonicalCm, type TypedUnit } from "@/lib/sizing";

export function CustomMeasurementsForm({
  fields,
  previousCm,
  leadTimeDays,
  returnable,
  surchargeLabel,
  unit,
  onUnitChange,
  values,
  onChange,
}: {
  fields: MeasurementFieldDef[];
  previousCm: Record<string, number>;
  leadTimeDays: number;
  returnable: boolean;
  surchargeLabel?: string | null;
  unit: TypedUnit;
  onUnitChange: (u: TypedUnit) => void;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const [usePrevious, setUsePrevious] = useState(false);
  const hasPrevious = useMemo(() => Object.keys(previousCm).length > 0, [previousCm]);

  const applyPrevious = () => {
    setUsePrevious(true);
    for (const f of fields) {
      const cm = previousCm[f.key];
      if (cm == null) continue;
      onChange(f.key, String(fromCanonicalCm(cm, unit)));
    }
  };

  return (
    <div
      id="custom-measurements"
      className="mt-5 space-y-5 border-2 border-choc bg-[#f7f2ec] p-5 md:p-6"
    >
      <div>
        <p className="font-display text-2xl text-choc">Your measurements</p>
        <p className="mt-2 font-body text-base leading-7 text-charcoal">
          {CUSTOM_LEAD_COPY(leadTimeDays)} Enter each figure carefully — this is what the workroom cuts from.
        </p>
      </div>
      {!returnable ? (
        <p className="border border-[#E8D5B0] bg-white px-3 py-2.5 font-body text-base leading-6 text-choc">
          {CUSTOM_RETURNS_COPY}
        </p>
      ) : null}
      {surchargeLabel ? (
        <p className="font-body text-base text-charcoal-mid">{surchargeLabel}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <p className="font-body text-sm font-medium text-charcoal">Unit</p>
        {(["cm", "in"] as const).map((u) => (
          <label key={u} className="inline-flex items-center gap-2 font-body text-base text-charcoal">
            <input type="radio" checked={unit === u} onChange={() => onUnitChange(u)} />
            {u === "cm" ? "Centimetres" : "Inches"}
          </label>
        ))}
      </div>

      {hasPrevious ? (
        <button
          type="button"
          onClick={applyPrevious}
          className="font-body text-base text-choc underline underline-offset-4"
        >
          {usePrevious ? "Saved measurements applied" : "Use my saved measurements"}
        </button>
      ) : null}

      <div className="space-y-5">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="font-body text-base font-medium text-choc">
              {f.label}
              {f.required ? " *" : ""}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="mt-1.5 w-full border border-choc/30 bg-white px-3 py-3 font-body text-lg text-choc outline-none focus:border-choc"
            />
            {f.helpText ? (
              <span className="mt-1.5 block font-body text-sm leading-6 text-charcoal-mid">{f.helpText}</span>
            ) : null}
          </label>
        ))}
      </div>
    </div>
  );
}

export function typedFromForm(
  fields: MeasurementFieldDef[],
  values: Record<string, string>,
  unit: TypedUnit,
): TypedMeasurement[] {
  const out: TypedMeasurement[] = [];
  for (const f of fields) {
    const raw = values[f.key]?.trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    out.push({ key: f.key, value: n, unit });
  }
  return out;
}
