"use client";

import { useMemo, useState } from "react";
import type { MeasurementFieldDef, TypedMeasurement } from "@/lib/custom-size";
import { CUSTOM_LEAD_COPY, CUSTOM_RETURNS_COPY } from "@/lib/custom-size";
import { MEASURE_HOW } from "@/lib/measurement-guide";
import { fromCanonicalCm, type TypedUnit } from "@/lib/sizing";
import {
  FieldError,
  MeasureGuide,
} from "@/components/measurements/MeasureGuide";

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
  errors = {},
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
  /** Per-field reasons the last Add to bag could not go through. */
  errors?: Record<string, string>;
}) {
  const [usePrevious, setUsePrevious] = useState(false);
  const hasPrevious = useMemo(
    () => Object.keys(previousCm).length > 0,
    [previousCm],
  );

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
      className="mt-5 min-w-0 space-y-5 rounded-sm border border-choc/40 bg-bg-page p-5 text-text-dark md:p-6"
    >
      <div>
        <p className="font-display text-2xl text-choc">Your measurements</p>
        <p className="mt-2 font-body text-base leading-7 text-text-dark">
          {CUSTOM_LEAD_COPY(leadTimeDays)} Enter each figure carefully — this is
          what the workroom cuts from.
        </p>
      </div>
      {!returnable ? (
        <p className="bg-bg-surface border-l-2 border-choc px-3 py-2.5 font-body text-[15px] leading-6 text-text-dark">
          {CUSTOM_RETURNS_COPY}
        </p>
      ) : null}
      {surchargeLabel ? (
        <p className="font-body text-base text-text-mid">{surchargeLabel}</p>
      ) : null}

      <MeasureGuide defaultOpen={!hasPrevious} />

      <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <legend className="sr-only">Unit</legend>
        <p aria-hidden className="font-body text-sm font-medium text-text-dark">
          Unit
        </p>
        {(["cm", "in"] as const).map((u) => (
          <label
            key={u}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-body text-base text-text-dark"
          >
            <input
              type="radio"
              name="custom-measure-unit"
              className="h-4 w-4 accent-[var(--choc)]"
              checked={unit === u}
              onChange={() => onUnitChange(u)}
            />
            {u === "cm" ? "Centimetres" : "Inches"}
          </label>
        ))}
      </fieldset>

      {hasPrevious ? (
        <button
          type="button"
          onClick={applyPrevious}
          className="font-body text-base text-choc underline underline-offset-4"
        >
          {usePrevious
            ? "Saved measurements applied"
            : "Use my saved measurements"}
        </button>
      ) : null}

      <div className="space-y-5">
        {fields.map((f) => {
          const err = errors[f.key];
          const how = f.helpText?.trim() || MEASURE_HOW[f.key] || null;
          const inputId = `cm-${f.key}`;
          const hintId = `${inputId}-hint`;
          const errId = `${inputId}-error`;
          const describedBy =
            [err ? errId : null, how ? hintId : null]
              .filter(Boolean)
              .join(" ") || undefined;
          return (
            <div key={f.key}>
              <label
                htmlFor={inputId}
                className="font-body text-base font-medium text-text-dark"
              >
                {f.label}
                {f.required ? (
                  <span className="text-text-mid">
                    {" "}
                    *<span className="sr-only"> (required)</span>
                  </span>
                ) : null}
                <span className="ml-1 font-sans text-xs font-normal text-text-light">
                  ({unit})
                </span>
              </label>
              <input
                id={inputId}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-required={f.required || undefined}
                aria-invalid={err ? true : undefined}
                aria-describedby={describedBy}
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                className={`mt-1.5 w-full rounded-sm border bg-input-bg px-3 py-3 font-body text-lg text-text-dark outline-none transition-colors focus:border-choc ${err ? "border-error" : "border-input-border"}`}
              />
              <FieldError id={errId} message={err} />
              {how ? (
                <span
                  id={hintId}
                  className="mt-1.5 block font-body text-sm leading-6 text-text-mid"
                >
                  {how}
                </span>
              ) : null}
            </div>
          );
        })}
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
    const raw = values[f.key]?.trim().replace(",", ".");
    if (!raw) continue;
    const n = Number(raw);
    // Not a number: keep it so validation can say so, instead of dropping it silently.
    out.push({ key: f.key, value: Number.isFinite(n) ? n : NaN, unit });
  }
  return out;
}
