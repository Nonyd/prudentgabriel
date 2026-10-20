import type { Prisma } from "@prisma/client";

/**
 * Pure helpers, safe in the browser. The server read is in measurement-fields.ts.
 *
 * Extra atelier measurements the house adds beyond the ten standard ones
 * (bust … armhole). Managed by atelier managers and admins on
 * Atelier → Measurement fields; shown on every commission's measurement form
 * and on the client's saved set.
 *
 * Values live in the same `values` JSON as the shop's custom-size extras
 * (Measurement.values, the commission snapshot's values), under keys that start
 * with `atelier_`, in the set's own unit (inches or cm) like the standard ten.
 * A field is never deleted, only retired: its key stays, so old values still read.
 */

export const ATELIER_MEASUREMENT_FIELDS_KEY = "atelier_measurement_fields";
export const ATELIER_FIELD_PREFIX = "atelier_";
const KEY = /^atelier_[a-z0-9_]{1,40}$/;

export type AtelierMeasurementField = {
  key: string;
  label: string;
  /** How to take it, shown under the input. */
  help?: string;
  /** Retired: no longer asked for; values already taken still show. */
  retired?: boolean;
};

export function isAtelierFieldKey(key: string): boolean {
  return KEY.test(key);
}

/** A label → a stable key, unique among `taken`. */
export function atelierFieldKey(label: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const slug =
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "field";
  let key = `${ATELIER_FIELD_PREFIX}${slug}`;
  for (let n = 2; used.has(key); n++) key = `${ATELIER_FIELD_PREFIX}${slug}_${n}`;
  return key;
}

export function cleanAtelierFields(raw: unknown): AtelierMeasurementField[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AtelierMeasurementField[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key : "";
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 60) : "";
    if (!isAtelierFieldKey(key) || !label || seen.has(key)) continue;
    seen.add(key);
    const help = typeof o.help === "string" ? o.help.trim().slice(0, 200) : "";
    out.push({ key, label, ...(help ? { help } : {}), ...(o.retired === true ? { retired: true } : {}) });
  }
  return out;
}


/** The atelier extras in a `values` JSON (other keys, e.g. the shop's custom-size extras, are left out). */
export function atelierExtrasFrom(values: Prisma.JsonValue | Record<string, unknown> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!values || typeof values !== "object" || Array.isArray(values)) return out;
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    if (!isAtelierFieldKey(k)) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/** Writes the atelier extras into an existing `values` JSON, keeping every other key. Null clears a value. */
export function mergeAtelierExtras(
  values: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  extra: Record<string, number | null>,
): Record<string, number> {
  const base: Record<string, number> = {};
  if (values && typeof values === "object" && !Array.isArray(values)) {
    for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) base[k] = n;
    }
  }
  for (const [k, v] of Object.entries(extra)) {
    if (!isAtelierFieldKey(k)) continue;
    if (v == null) delete base[k];
    else base[k] = v;
  }
  return base;
}

/** Validates `extra` from a request: atelier keys only, positive numbers or null. */
export function cleanAtelierExtraInput(
  raw: unknown,
): { ok: true; extra: Record<string, number | null> } | { ok: false; key: string } {
  const extra: Record<string, number | null> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: true, extra };
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isAtelierFieldKey(k)) continue;
    if (v === null || v === "") {
      extra[k] = null;
      continue;
    }
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > 400) return { ok: false, key: k };
    extra[k] = Math.round(n * 100) / 100;
  }
  return { ok: true, extra };
}
