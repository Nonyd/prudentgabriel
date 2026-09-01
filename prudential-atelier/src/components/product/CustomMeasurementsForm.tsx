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
    <div className="mt-6 space-y-4 border border-sand bg-ivory/60 p-4">
      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-choc">
        Made to your measurements
      </p>
      <p className="font-body text-[13px] leading-5 text-charcoal-mid">{CUSTOM_LEAD_COPY(leadTimeDays)}</p>
      {!returnable ? (
        <p className="font-body text-[13px] leading-5 text-choc">{CUSTOM_RETURNS_COPY}</p>
      ) : null}
      {surchargeLabel ? <p className="font-body text-[12px] text-charcoal-mid">{surchargeLabel}</p> : null}

      <div className="flex items-center gap-3">
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.14em] text-text-light">Unit</p>
        {(["cm", "in"] as const).map((u) => (
          <label key={u} className="inline-flex items-center gap-1 font-body text-sm text-charcoal">
            <input type="radio" checked={unit === u} onChange={() => onUnitChange(u)} />
            {u === "cm" ? "Centimetres" : "Inches"}
          </label>
        ))}
      </div>

      {hasPrevious ? (
        <button
          type="button"
          onClick={applyPrevious}
          className="font-body text-[11px] font-medium uppercase tracking-wide text-choc underline"
        >
          {usePrevious ? "Previous measurements applied" : "Use my saved measurements"}
        </button>
      ) : null}

      <div className="space-y-4">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="font-body text-[10px] font-medium uppercase tracking-[0.14em] text-text-light">
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
              className="mt-1 w-full border border-border bg-white px-3 py-2 font-body text-sm text-charcoal"
            />
            {f.helpText ? (
              <span className="mt-1 block font-body text-[12px] leading-5 text-charcoal-mid">{f.helpText}</span>
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
