"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { profileMeasurementProblems, type MeasurementData } from "@/lib/measurements";
import { PROFILE_MEASUREMENT_GUIDE, readableApiError } from "@/lib/measurement-guide";
import { FieldError, FormErrorSummary } from "@/components/measurements/MeasureGuide";
import {
  ATELIER_TEXT_MAX,
  atelierExtrasFrom,
  DEFAULT_ATELIER_SHEET,
  isStandardMeasurementColumn,
  measurementSheetRows,
  STANDARD_MEASUREMENT_COLUMNS,
  STANDARD_MEASUREMENT_LABELS,
  type AtelierExtraValue,
  type AtelierMeasurementField,
} from "@/lib/atelier/measurement-fields-shared";

export type { MeasurementData } from "@/lib/measurements";

type MeasurementFieldKey = (typeof STANDARD_MEASUREMENT_COLUMNS)[number];

const HOW: Record<MeasurementFieldKey, string> = Object.fromEntries(
  PROFILE_MEASUREMENT_GUIDE.map((g) => [g.key, g.how]),
) as Record<MeasurementFieldKey, string>;

/** A saved set from any route (a commission's, or her raw Measurement row) with its atelier extras read. */
function normalize(d: MeasurementData | null | undefined): MeasurementData | null {
  if (!d) return null;
  const values = (d as { values?: unknown }).values as Record<string, unknown> | null | undefined;
  return { ...d, extra: d.extra ?? atelierExtrasFrom(values) };
}

function hasAnyValue(d: MeasurementData): boolean {
  return STANDARD_MEASUREMENT_COLUMNS.some((c) => d[c] != null) || Object.keys(d.extra ?? {}).length > 0;
}

/** The house sheet (Atelier → Measurement fields), loaded once per panel; the default until it arrives. */
function useAtelierFields(): AtelierMeasurementField[] {
  const [fields, setFields] = useState<AtelierMeasurementField[]>(DEFAULT_ATELIER_SHEET);
  useEffect(() => {
    let live = true;
    void fetch("/api/atelier/measurement-fields")
      .then((r) => (r.ok ? r.json() : { fields: [] }))
      .then((j: { fields?: AtelierMeasurementField[] }) => {
        if (live && j.fields?.length) setFields(j.fields);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return fields;
}

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
    extra: {},
  };
}

export async function patchClientMeasurements(clientId: string, form: MeasurementData) {
  const unit = form.unit === "cm" ? "cm" : "inches";
  const res = await fetch(`/api/clients/${clientId}/measurements`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...form, unit }),
  });
  const j = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error(readableApiError(j, `Measurements could not be saved (error ${res.status}).`));
}

/** BD6: save a commission's own set (and her latest with it). */
export async function patchCommissionMeasurements(orderId: string, form: MeasurementData) {
  const unit = form.unit === "cm" ? "cm" : "inches";
  const res = await fetch(`/api/bespoke/${orderId}/measurements`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...form, unit }),
  });
  const j = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error(readableApiError(j, `Measurements could not be saved (error ${res.status}).`));
}

export function ClientMeasurementsPanel({
  clientId,
  clientName,
  initial,
  compact = false,
  onSaved,
  onDraftChange,
  saveUrl,
  title = "Client Measurements",
  savedMessage,
  caption,
}: {
  clientId: string | null;
  clientName: string;
  initial?: MeasurementData | null;
  compact?: boolean;
  onSaved?: () => void;
  onDraftChange?: (draft: MeasurementData | null) => void;
  /** BD6: where the set is saved. Default: her client profile. */
  saveUrl?: string;
  title?: string;
  savedMessage?: string;
  /** A line under the title, e.g. whose set this is and when it was taken. */
  caption?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unit, setUnit] = useState<"inches" | "cm">(
    initial?.unit === "cm" ? "cm" : "inches",
  );
  const [form, setForm] = useState<MeasurementData>(normalize(initial) ?? emptyForm("inches"));
  const atelierFields = useAtelierFields();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!onDraftChange || !clientId) return;
    onDraftChange(hasAnyValue(form) ? { ...form, unit } : null);
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

  const hasData = hasAnyValue(form);
  const unitLabel = unit === "cm" ? "cm" : '"';
  const extra = form.extra ?? {};
  const valueOf = (key: string) => (isStandardMeasurementColumn(key) ? form[key] : extra[key]);
  // Asked for, in sheet order: every current field, plus one no longer asked that still
  // holds a value (so it can be cleared), then a standard column off the sheet that holds one.
  const inputs: AtelierMeasurementField[] = [
    ...atelierFields.filter((f) => !f.retired || valueOf(f.key) != null),
    ...STANDARD_MEASUREMENT_COLUMNS.filter((c) => form[c] != null && !atelierFields.some((f) => f.key === c)).map(
      (c) => ({ key: c, label: STANDARD_MEASUREMENT_LABELS[c], retired: true }),
    ),
  ];
  const shown = measurementSheetRows(atelierFields, form);

  function setExtra(key: string, value: AtelierExtraValue | null) {
    setForm((prev) => {
      const next = { ...(prev.extra ?? {}) };
      if (value == null) delete next[key];
      else next[key] = value;
      return { ...prev, extra: next };
    });
  }

  async function save() {
    const problems = profileMeasurementProblems({ ...form, unit });
    if (problems) {
      setFieldErrors(problems.fieldErrors as Record<string, string>);
      setFormError(problems.error);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setSaving(true);
    try {
      let res: Response;
      try {
        const extraBody: Record<string, AtelierExtraValue | null> = {};
        for (const f of atelierFields) if (!isStandardMeasurementColumn(f.key)) extraBody[f.key] = extra[f.key] ?? null;
        for (const [k, v] of Object.entries(extra)) extraBody[k] = v;
        res = await fetch(saveUrl ?? `/api/clients/${clientId}/measurements`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, unit, extra: extraBody }),
        });
      } catch {
        throw new Error("Could not reach the server — check the connection and try again.");
      }
      const j = (await res.json().catch(() => null)) as {
        error?: unknown;
        fieldErrors?: Record<string, string>;
        item?: MeasurementData | { data: MeasurementData | null };
      } | null;
      if (!res.ok || !j) {
        setFieldErrors(j?.fieldErrors ?? {});
        throw new Error(readableApiError(j, `Measurements could not be saved (error ${res.status}).`));
      }
      const saved = j.item && "data" in j.item ? j.item.data : (j.item as MeasurementData | undefined);
      if (saved) setForm(normalize(saved) ?? saved);
      toast.success(savedMessage ?? `Measurements saved to ${clientName}'s profile`);
      setEditing(false);
      onSaved?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save measurements";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={compact ? "mt-4 rounded border border-sand bg-ivory/50 p-4" : "card-surface p-6"}>
      <h2 className="panel-title font-sans font-semibold uppercase text-text-light">{title}</h2>
      {caption ? <div className="mt-1 font-sans text-xs text-text-mid">{caption}</div> : null}

      {!editing && hasData ? (
        <>
          {form.updatedAt ? (
            <p className="mt-2 font-sans text-xs text-text-light">
              Last updated: {formatDate(form.updatedAt)}
            </p>
          ) : null}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {shown.map((r) => (
              <div key={r.key}>
                <dt className="font-sans text-11px text-text-light">
                  {r.label}
                  {r.notAsked ? <span className="ml-1">(no longer asked)</span> : null}
                </dt>
                <dd className="font-sans text-sm text-choc">
                  {r.value}
                  {r.text ? "" : unitLabel}
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
              setForm(normalize(initial) ?? emptyForm(unit));
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
            {inputs.map((f) => {
              const err = fieldErrors[f.key];
              const id = `cmp-${clientId}-${f.key}`;
              const column = isStandardMeasurementColumn(f.key) ? f.key : null;
              const hint = f.help ?? (column ? HOW[column] : undefined);
              const clearError = () => {
                if (!err) return;
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next[f.key];
                  return next;
                });
              };
              return (
                <div key={f.key}>
                  <label htmlFor={id} className="block font-sans text-xs text-text-mid">
                    {f.label}
                    {f.retired ? <span className="ml-1 text-text-light">(no longer asked)</span> : null}
                  </label>
                  {column ? (
                    <input
                      id={id}
                      type="number"
                      step="0.1"
                      value={form[column] ?? ""}
                      aria-invalid={err ? true : undefined}
                      aria-describedby={hint ? `${id}-hint` : undefined}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, [column]: e.target.value === "" ? null : Number(e.target.value) }));
                        clearError();
                      }}
                      className={`input-field mt-1${err ? " !border-error" : ""}`}
                    />
                  ) : f.type === "text" ? (
                    <input
                      id={id}
                      type="text"
                      maxLength={ATELIER_TEXT_MAX}
                      value={extra[f.key] != null ? String(extra[f.key]) : ""}
                      aria-invalid={err ? true : undefined}
                      aria-describedby={hint ? `${id}-hint` : undefined}
                      onChange={(e) => {
                        setExtra(f.key, e.target.value.trim() ? e.target.value : null);
                        clearError();
                      }}
                      className={`input-field mt-1${err ? " !border-error" : ""}`}
                    />
                  ) : (
                    <input
                      id={id}
                      type="number"
                      step="0.1"
                      min={0}
                      value={extra[f.key] ?? ""}
                      aria-invalid={err ? true : undefined}
                      aria-describedby={hint ? `${id}-hint` : undefined}
                      onChange={(e) => {
                        setExtra(f.key, e.target.value === "" ? null : Number(e.target.value));
                        clearError();
                      }}
                      className={`input-field mt-1${err ? " !border-error" : ""}`}
                    />
                  )}
                  <FieldError id={`${id}-error`} message={err} />
                  {hint ? (
                    <span id={`${id}-hint`} className="mt-0.5 block font-sans text-[11px] leading-4 text-text-light">
                      {hint}
                    </span>
                  ) : null}
                </div>
              );
            })}
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
          <FormErrorSummary message={formError} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save Measurements"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setForm(normalize(initial) ?? emptyForm(unit));
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
