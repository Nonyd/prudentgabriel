import type { Prisma } from "@prisma/client";

/**
 * Pure helpers, safe in the browser. The server read is in measurement-fields.ts.
 *
 * The atelier measurement sheet: the measurements the house takes, in the order
 * it takes them. Managed by atelier managers and admins on Atelier → Measurement
 * fields; shown on every commission's measurement form and on the client's
 * saved set.
 *
 * An entry is either one of the ten standard columns on Measurement (bust …
 * armhole; a set already holds these) under the house's own name for it, or an
 * atelier field. Atelier values live in the same `values` JSON as the shop's
 * custom-size extras (Measurement.values, the commission snapshot's values),
 * under keys that start with `atelier_`, in the set's own unit (inches or cm).
 * A field is never deleted, only retired: its key stays, so old values still read.
 */

export const ATELIER_MEASUREMENT_FIELDS_KEY = "atelier_measurement_fields";
export const ATELIER_FIELD_PREFIX = "atelier_";
const KEY = /^atelier_[a-z0-9_]{1,40}$/;

/** The ten columns every measurement set has (Measurement, the commission snapshot). */
export const STANDARD_MEASUREMENT_COLUMNS = [
  "bust",
  "waist",
  "hips",
  "shoulderWidth",
  "sleeveLength",
  "dressLength",
  "thigh",
  "inseam",
  "neck",
  "armhole",
] as const;
export type StandardMeasurementColumn = (typeof STANDARD_MEASUREMENT_COLUMNS)[number];

/** Their names where the house sheet does not give one. */
export const STANDARD_MEASUREMENT_LABELS: Record<StandardMeasurementColumn, string> = {
  bust: "Bust",
  waist: "Waist",
  hips: "Hips",
  shoulderWidth: "Shoulder",
  sleeveLength: "Sleeve",
  dressLength: "Dress length",
  thigh: "Thigh",
  inseam: "Inseam",
  neck: "Neck",
  armhole: "Armhole",
};

export type AtelierMeasurementField = {
  /** A standard column (`bust`) or an atelier field (`atelier_…`). */
  key: string;
  label: string;
  /** How to take it, shown under the input. */
  help?: string;
  /** "text": a word or size, not a length (cup size). Atelier fields only. */
  type?: "text";
  /** Retired: no longer asked for; values already taken still show. */
  retired?: boolean;
};

export function isAtelierFieldKey(key: string): boolean {
  return KEY.test(key);
}

export function isStandardMeasurementColumn(key: string): key is StandardMeasurementColumn {
  return (STANDARD_MEASUREMENT_COLUMNS as readonly string[]).includes(key);
}

/** A key the sheet may list: a standard column or an atelier field. */
export function isSheetKey(key: string): boolean {
  return isStandardMeasurementColumn(key) || isAtelierFieldKey(key);
}

/**
 * The house sheet until a manager changes it, in the order it is taken. Six
 * entries are the standard columns under the house's names, so sets already
 * saved keep their figures; sleeve, dress length, thigh and inseam are not on
 * it (still shown where a set holds them).
 */
export const DEFAULT_ATELIER_SHEET: AtelierMeasurementField[] = [
  { key: "shoulderWidth", label: "Shoulder" },
  { key: "bust", label: "Bust circumference" },
  { key: "atelier_under_bust_circumference", label: "Under-bust circumference" },
  { key: "atelier_bust_point", label: "Bust point" },
  { key: "atelier_under_bust_point", label: "Under-bust point" },
  { key: "atelier_front_half_length", label: "Front half length" },
  { key: "atelier_bust_span", label: "Bust span" },
  { key: "atelier_back_half_length", label: "Back half length" },
  { key: "waist", label: "Waist" },
  { key: "armhole", label: "Armhole circumference" },
  { key: "atelier_biceps_circumference", label: "Biceps circumference" },
  { key: "atelier_elbow_circumference", label: "Elbow circumference" },
  { key: "atelier_wrist_circumference", label: "Wrist circumference" },
  { key: "atelier_arms_eye", label: "Arm's eye" },
  { key: "atelier_shoulder_to_elbow", label: "Shoulder to elbow" },
  { key: "atelier_shoulder_to_wrist", label: "Shoulder to wrist" },
  { key: "hips", label: "Hips" },
  { key: "atelier_waist_to_knee", label: "Waist to knee" },
  { key: "atelier_waist_to_ankle", label: "Waist to ankle" },
  { key: "atelier_knee_circumference", label: "Knee circumference" },
  { key: "atelier_across_chest", label: "Across chest" },
  { key: "atelier_across_back", label: "Across back" },
  { key: "neck", label: "Round neck" },
  { key: "atelier_cup_size", label: "Cup size", type: "text" },
];

/** A measurement: a length in the set's unit, or a word/size for a text field. */
export type AtelierExtraValue = number | string;

export type SheetRow = {
  key: string;
  label: string;
  value: AtelierExtraValue;
  /** A word or size: shown without the unit. */
  text: boolean;
  /** Not on the sheet now; shown because this set holds it. */
  notAsked: boolean;
};

/**
 * The figures a set holds, in sheet order: the sheet's fields first, then any
 * standard column or atelier value the sheet no longer asks for. Empty ones are
 * left out.
 */
/** The keys of the sheet's text fields (cup size), for cleanAtelierExtraInput. */
export function textFieldKeys(fields: readonly AtelierMeasurementField[]): Set<string> {
  return new Set(fields.filter((f) => f.type === "text").map((f) => f.key));
}

export function measurementSheetRows(
  fields: readonly AtelierMeasurementField[],
  data: Partial<Record<StandardMeasurementColumn, number | null>> & {
    extra?: Record<string, AtelierExtraValue>;
  },
): SheetRow[] {
  const extra = data.extra ?? {};
  const valueOf = (key: string): AtelierExtraValue | null =>
    isStandardMeasurementColumn(key) ? (data[key] ?? null) : (extra[key] ?? null);
  const rows: SheetRow[] = [];
  const listed = new Set<string>();
  for (const f of fields) {
    listed.add(f.key);
    const value = valueOf(f.key);
    if (value == null || value === "") continue;
    rows.push({ key: f.key, label: f.label, value, text: f.type === "text", notAsked: f.retired === true });
  }
  for (const col of STANDARD_MEASUREMENT_COLUMNS) {
    const value = data[col];
    if (listed.has(col) || value == null) continue;
    rows.push({ key: col, label: STANDARD_MEASUREMENT_LABELS[col], value, text: false, notAsked: true });
  }
  for (const [key, value] of Object.entries(extra)) {
    if (listed.has(key) || value === "") continue;
    rows.push({
      key,
      label: key.replace(/^atelier_/, "").replace(/_/g, " "),
      value,
      text: typeof value === "string",
      notAsked: true,
    });
  }
  return rows;
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
    if (!isSheetKey(key) || !label || seen.has(key)) continue;
    seen.add(key);
    const help = typeof o.help === "string" ? o.help.trim().slice(0, 200) : "";
    // Standard columns hold numbers; only an atelier field can be text.
    const text = o.type === "text" && isAtelierFieldKey(key);
    out.push({
      key,
      label,
      ...(help ? { help } : {}),
      ...(text ? { type: "text" as const } : {}),
      ...(o.retired === true ? { retired: true } : {}),
    });
  }
  return out;
}


/** A word or size a text field holds (cup size: "34C"). */
export const ATELIER_TEXT_MAX = 20;

/** A stored value as the house reads it: a number, or the words of a text field. */
function storedValue(v: unknown): AtelierExtraValue | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const text = v.trim();
    return text ? text.slice(0, ATELIER_TEXT_MAX) : null;
  }
  return null;
}

/** The atelier extras in a `values` JSON (other keys, e.g. the shop's custom-size extras, are left out). */
export function atelierExtrasFrom(
  values: Prisma.JsonValue | Record<string, unknown> | null | undefined,
): Record<string, AtelierExtraValue> {
  const out: Record<string, AtelierExtraValue> = {};
  if (!values || typeof values !== "object" || Array.isArray(values)) return out;
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    if (!isAtelierFieldKey(k)) continue;
    const value = storedValue(v);
    if (value != null) out[k] = value;
  }
  return out;
}

/** Writes the atelier extras into an existing `values` JSON, keeping every other key. Null clears a value. */
export function mergeAtelierExtras(
  values: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  extra: Record<string, AtelierExtraValue | null>,
): Record<string, AtelierExtraValue> {
  const base: Record<string, AtelierExtraValue> = {};
  if (values && typeof values === "object" && !Array.isArray(values)) {
    for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
      // The shop's custom-size extras are numbers; atelier text fields keep their words.
      const value = isAtelierFieldKey(k) ? storedValue(v) : typeof v === "number" ? v : Number(v);
      if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) base[k] = value;
    }
  }
  for (const [k, v] of Object.entries(extra)) {
    if (!isAtelierFieldKey(k)) continue;
    if (v == null) delete base[k];
    else base[k] = v;
  }
  return base;
}

/**
 * Validates `extra` from a request: atelier keys only. A length is a positive
 * number; anything else that is not a number is a text field's words (cup
 * size), kept short. Empty or null clears it.
 */
export function cleanAtelierExtraInput(
  raw: unknown,
  /** The sheet's text fields. Given (on the server), words are accepted only for these. */
  textKeys?: ReadonlySet<string>,
): { ok: true; extra: Record<string, AtelierExtraValue | null> } | { ok: false; key: string } {
  const extra: Record<string, AtelierExtraValue | null> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: true, extra };
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isAtelierFieldKey(k)) continue;
    if (v === null || (typeof v === "string" && !v.trim())) {
      extra[k] = null;
      continue;
    }
    const n = typeof v === "number" ? v : Number(v);
    if (typeof v === "string" && !Number.isFinite(n)) {
      if (textKeys && !textKeys.has(k)) return { ok: false, key: k };
      if (v.trim().length > ATELIER_TEXT_MAX) return { ok: false, key: k };
      extra[k] = v.trim();
      continue;
    }
    if (!Number.isFinite(n) || n <= 0 || n > 400) return { ok: false, key: k };
    extra[k] = Math.round(n * 100) / 100;
  }
  return { ok: true, extra };
}
