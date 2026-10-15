/**
 * How to measure — one source for every measurement form (her account, the
 * product page's made-to-measure panel, admin and staff). Client-safe: no prisma.
 *
 * The per-field lines are the ones the house catalog seeded (slice R); the
 * product page shows the catalog's own helpText first and falls back to these.
 */

export const MEASURE_INTRO_TITLE = "How to measure";

export const MEASURE_INTRO_TIPS: readonly string[] = [
  "Use a soft tailor's tape, not a metal one.",
  "Measure over light underwear or a thin slip, not over clothes.",
  "Stand straight and relaxed, feet together, arms by your sides.",
  "Keep the tape level and snug against the body, never tight.",
  "Ask someone to help: it is hard to measure your own back and shoulders.",
];

/** One line per measurement, keyed by the catalog key (snake_case). */
export const MEASURE_HOW: Record<string, string> = {
  bust: "Measure around the fullest part of the bust, keeping the tape level.",
  underbust:
    "Measure directly under the bust, keeping the tape level and snug but not tight.",
  waist:
    "Measure around your natural waistline — the narrowest part of your torso.",
  hip: "Stand with feet together. Measure around the fullest part of the hips.",
  shoulder:
    "Measure from the edge of one shoulder to the other across your back.",
  shoulder_to_waist:
    "Measure from the bone at the base of the neck down to your natural waist.",
  skirt_length: "From the waist to the desired hem of the skirt.",
  pant_length:
    "From the waist to the desired hem of the trouser, along the outside leg.",
  biceps: "Measure around the fullest part of the upper arm.",
  sleeve_length:
    "With your arm slightly bent, measure from the shoulder point to where you want the sleeve to end.",
  blouse_length: "From the shoulder to the desired hem of the blouse.",
  dress_length:
    "Measure from the shoulder (or waist, for skirts) down to where you want the hem to fall.",
  thigh: "Measure around the fullest part of the upper thigh.",
  inseam: "Measure from the crotch down the inside of the leg to the hem.",
  neck: "Measure around the base of the neck, where a collar would sit.",
  armhole: "Measure around the shoulder joint where the sleeve is set in.",
};

/** The saved-set columns (her account, admin, staff) in the order the house reads them. */
export type ProfileMeasurementKey =
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

export type ProfileFieldGuide = {
  key: ProfileMeasurementKey;
  label: string;
  how: string;
  /** Generous adult bounds: catch a slipped tape or the wrong unit, never a real body. */
  minCm: number;
  maxCm: number;
};

export const PROFILE_MEASUREMENT_GUIDE: readonly ProfileFieldGuide[] = [
  { key: "bust", label: "Bust", how: MEASURE_HOW.bust, minCm: 70, maxCm: 180 },
  {
    key: "waist",
    label: "Waist",
    how: MEASURE_HOW.waist,
    minCm: 50,
    maxCm: 170,
  },
  { key: "hips", label: "Hips", how: MEASURE_HOW.hip, minCm: 70, maxCm: 190 },
  {
    key: "shoulderWidth",
    label: "Shoulder Width",
    how: MEASURE_HOW.shoulder,
    minCm: 28,
    maxCm: 60,
  },
  {
    key: "sleeveLength",
    label: "Sleeve Length",
    how: MEASURE_HOW.sleeve_length,
    minCm: 20,
    maxCm: 85,
  },
  {
    key: "dressLength",
    label: "Dress Length",
    how: MEASURE_HOW.dress_length,
    minCm: 40,
    maxCm: 180,
  },
  {
    key: "thigh",
    label: "Thigh",
    how: MEASURE_HOW.thigh,
    minCm: 35,
    maxCm: 100,
  },
  {
    key: "inseam",
    label: "Inseam",
    how: MEASURE_HOW.inseam,
    minCm: 45,
    maxCm: 100,
  },
  { key: "neck", label: "Neck", how: MEASURE_HOW.neck, minCm: 25, maxCm: 55 },
  {
    key: "armhole",
    label: "Armhole",
    how: MEASURE_HOW.armhole,
    minCm: 28,
    maxCm: 70,
  },
];

export type GuideUnit = "cm" | "inches" | "in";

function cmToUnit(cm: number, unit: GuideUnit): number {
  return unit === "cm" ? cm : cm / 2.54;
}

/** "between 50 and 140 cm" / "between 19 and 56 in", rounded outward so the bound itself passes. */
export function rangePhrase(
  minCm: number,
  maxCm: number,
  unit: GuideUnit,
): string {
  const lo = Math.floor(cmToUnit(minCm, unit));
  const hi = Math.ceil(cmToUnit(maxCm, unit));
  return `between ${lo} and ${hi} ${unit === "cm" ? "cm" : "in"}`;
}

/**
 * One typed figure → the reason it cannot be saved, or null. Empty is allowed
 * here (the caller decides what is required).
 */
export function measurementFieldError(
  label: string,
  raw: string | number | null | undefined,
  unit: GuideUnit,
  bounds: { minCm?: number | null; maxCm?: number | null },
): string | null {
  if (raw == null) return null;
  const text = typeof raw === "number" ? String(raw) : raw.trim();
  if (!text) return null;
  const n = Number(text.replace(",", "."));
  if (!Number.isFinite(n)) return `${label}: please enter a number, e.g. 34.5`;
  if (n <= 0) return `${label} must be greater than zero`;
  const cm = unit === "cm" ? n : n * 2.54;
  const { minCm, maxCm } = bounds;
  if ((minCm != null && cm < minCm) || (maxCm != null && cm > maxCm)) {
    if (minCm != null && maxCm != null)
      return `${label} must be ${rangePhrase(minCm, maxCm, unit)}`;
    if (minCm != null)
      return `${label} looks too small — please check the tape`;
    return `${label} looks too large — please check the tape`;
  }
  return null;
}

/** Check a saved-set payload (profile columns) → per-field reasons. */
export function profileMeasurementErrors(
  values: Partial<
    Record<ProfileMeasurementKey, string | number | null | undefined>
  >,
  unit: GuideUnit,
): Partial<Record<ProfileMeasurementKey, string>> {
  const out: Partial<Record<ProfileMeasurementKey, string>> = {};
  for (const f of PROFILE_MEASUREMENT_GUIDE) {
    const err = measurementFieldError(f.label, values[f.key], unit, f);
    if (err) out[f.key] = err;
  }
  return out;
}

/** Turn any API error body into one readable sentence. */
export function readableApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const b = body as { error?: unknown; message?: unknown };
  if (typeof b.error === "string" && b.error.trim()) return b.error;
  if (typeof b.message === "string" && b.message.trim()) return b.message;
  if (b.error && typeof b.error === "object") {
    const flat = b.error as {
      formErrors?: unknown;
      fieldErrors?: Record<string, unknown>;
    };
    const form = Array.isArray(flat.formErrors)
      ? flat.formErrors.find((x) => typeof x === "string")
      : null;
    if (typeof form === "string") return form;
    for (const [k, v] of Object.entries(flat.fieldErrors ?? {})) {
      if (Array.isArray(v) && typeof v[0] === "string") return `${k}: ${v[0]}`;
    }
  }
  return fallback;
}
