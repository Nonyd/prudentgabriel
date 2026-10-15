"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Measurement } from "@prisma/client";
import {
  FieldError,
  FormErrorSummary,
  MeasureGuide,
} from "@/components/measurements/MeasureGuide";
import {
  PROFILE_MEASUREMENT_GUIDE,
  readableApiError,
} from "@/lib/measurement-guide";
import { profileMeasurementProblems } from "@/lib/measurements";

const FIELDS = PROFILE_MEASUREMENT_GUIDE;

function convert(
  val: number | null | undefined,
  unit: "inches" | "cm",
  displayUnit: "inches" | "cm",
) {
  if (val == null) return null;
  if (unit === displayUnit) return val;
  return displayUnit === "cm"
    ? Math.round(val * 2.54 * 10) / 10
    : Math.round((val / 2.54) * 10) / 10;
}

export function MeasurementsClient({
  initial,
}: {
  initial: Measurement | null;
}) {
  const [data, setData] = useState(initial);
  const [displayUnit, setDisplayUnit] = useState<"inches" | "cm">(
    (initial?.unit as "inches" | "cm") ?? "inches",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formUnit, setFormUnit] = useState<"inches" | "cm">("inches");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const storedUnit = (data?.unit as "inches" | "cm") ?? "inches";

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, saving]);

  function openModal() {
    const next: Record<string, string> = {};
    FIELDS.forEach(({ key }) => {
      const v = data?.[key];
      next[key] = v != null ? String(v) : "";
    });
    setForm(next);
    setFormUnit(storedUnit);
    setFieldErrors({});
    setFormError(null);
    setModalOpen(true);
  }

  function showProblems(errors: Record<string, string>, summary: string) {
    setFieldErrors(errors);
    setFormError(summary);
    const first = FIELDS.find((f) => errors[f.key]);
    if (first) document.getElementById(`m-${first.key}`)?.focus();
    else
      dialogRef.current?.scrollTo({
        top: dialogRef.current.scrollHeight,
        behavior: "smooth",
      });
  }

  async function save() {
    // Check here first so she sees the reason the server would give, next to the field.
    const problems = profileMeasurementProblems({ ...form, unit: formUnit });
    if (problems) {
      showProblems(
        problems.fieldErrors as Record<string, string>,
        problems.error,
      );
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { unit: formUnit };
      FIELDS.forEach(({ key }) => {
        const raw = form[key]?.trim().replace(",", ".");
        payload[key] = raw ? Number(raw) : null;
      });
      if (data?.notes) payload.notes = data.notes;

      let res: Response;
      try {
        res = await fetch("/api/account/measurements", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        showProblems(
          {},
          "We could not reach the atelier — check your connection and try again.",
        );
        return;
      }
      const json = (await res.json().catch(() => null)) as {
        measurements?: Measurement;
        error?: unknown;
        fieldErrors?: Record<string, string>;
      } | null;
      if (!res.ok || !json?.measurements) {
        const fallback =
          res.status === 401
            ? "Your session has ended — please sign in again, then save."
            : `Your measurements could not be saved (error ${res.status}). Please try again.`;
        showProblems(
          json?.fieldErrors ?? {},
          res.status === 401 ? fallback : readableApiError(json, fallback),
        );
        return;
      }
      setData(json.measurements);
      setDisplayUnit(formUnit);
      setModalOpen(false);
      toast.success("Measurements updated");
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
              Last updated:{" "}
              {new Date(data.updatedAt).toLocaleDateString("en-GB")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDisplayUnit("inches")}
            className={`px-3 py-1 font-sans text-xs ${displayUnit === "inches" ? "bg-nut text-ivory" : "border border-sand text-text-mid"}`}
          >
            Inches
          </button>
          <button
            type="button"
            onClick={() => setDisplayUnit("cm")}
            className={`px-3 py-1 font-sans text-xs ${displayUnit === "cm" ? "bg-nut text-ivory" : "border border-sand text-text-mid"}`}
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
          <button
            type="button"
            onClick={openModal}
            className="btn-primary mt-6"
          >
            Add Your Measurements
          </button>
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {FIELDS.map(({ key, label }) => {
              const val = convert(
                data[key] as number | null,
                storedUnit,
                displayUnit,
              );
              return (
                <div
                  key={key}
                  className="border border-sand/60 bg-bg-card p-4 text-center"
                >
                  <p className="font-display text-[32px] text-choc">
                    {val ?? "—"}
                  </p>
                  <p className="font-sans text-[10px] uppercase text-text-light">
                    {displayUnit}
                  </p>
                  <p className="mt-1 font-sans text-[11px] uppercase tracking-wider text-text-mid">
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
          {data.notes ? (
            <p className="mt-6 font-sans text-sm text-text-mid">{data.notes}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openModal}
              className="btn-ghost-light"
            >
              Update Measurements
            </button>
            <a
              href="/api/account/measurements/pdf"
              className="btn-primary inline-flex"
            >
              Download measurements
            </a>
          </div>
        </>
      )}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setModalOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="measurements-dialog-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-sand/60 bg-bg-page p-5 text-text-dark shadow-2xl sm:max-h-[90vh] sm:p-7"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2
                id="measurements-dialog-title"
                className="font-display text-2xl text-choc sm:text-3xl"
              >
                Update Measurements
              </h2>
              <div
                className="flex shrink-0 gap-2"
                role="radiogroup"
                aria-label="Unit"
              >
                {(["inches", "cm"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={formUnit === u}
                    onClick={() => {
                      setFormUnit(u);
                      setFieldErrors({});
                      setFormError(null);
                    }}
                    className={`min-h-9 rounded-full px-3.5 font-sans text-xs ${formUnit === u ? "bg-nut text-ivory" : "border border-sand text-text-mid"}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 font-body text-sm leading-6 text-text-mid">
              Every figure in {formUnit === "cm" ? "centimetres" : "inches"}.
              Leave a field empty if you are not sure — the atelier will take it
              at your fitting.
            </p>

            <MeasureGuide className="mt-4" defaultOpen={!data} />

            <div className="mt-5 grid gap-x-4 gap-y-4 sm:grid-cols-2">
              {FIELDS.map(({ key, label, how }) => {
                const err = fieldErrors[key];
                const hintId = `m-${key}-hint`;
                const errId = `m-${key}-error`;
                return (
                  <div key={key}>
                    <label
                      htmlFor={`m-${key}`}
                      className="font-sans text-xs font-medium tracking-wide text-text-dark"
                    >
                      {label}{" "}
                      <span className="font-normal text-text-light">
                        ({formUnit === "cm" ? "cm" : "in"})
                      </span>
                    </label>
                    <input
                      id={`m-${key}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={form[key] ?? ""}
                      aria-invalid={err ? true : undefined}
                      aria-describedby={err ? `${errId} ${hintId}` : hintId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((f) => ({ ...f, [key]: value }));
                        if (err) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                          });
                        }
                      }}
                      className={`mt-1 w-full rounded-sm border bg-input-bg px-3 py-2.5 font-sans text-base text-text-dark outline-none transition-colors placeholder:text-text-light focus:border-choc ${err ? "border-error" : "border-input-border"}`}
                    />
                    <FieldError id={errId} message={err} />
                    <span
                      id={hintId}
                      className="mt-1 block font-body text-[12px] leading-5 text-text-mid"
                    >
                      {how}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pinned to the bottom with Save, so the reason is in view wherever she has scrolled. */}
            <div className="sticky -bottom-5 -mx-5 -mb-5 mt-6 border-t border-sand/50 bg-bg-page px-5 py-4 sm:-bottom-7 sm:-mx-7 sm:-mb-7 sm:px-7">
              <FormErrorSummary message={formError} className="mb-3" />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="btn-ghost-light"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  aria-busy={saving}
                  className="btn-primary"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
