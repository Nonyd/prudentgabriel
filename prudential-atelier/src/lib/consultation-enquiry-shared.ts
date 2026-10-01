/**
 * Slice BA2 — consultation by invitation. Client-safe (no server imports):
 * the enquiry form, the booking page and the server all read these.
 */

/**
 * The enquiry's first question: what the dress is for (the house's list, 30
 * September). "Other" asks her to describe it. The label is what is stored on
 * the enquiry's `eventType` and carried to the booking as its occasion.
 */
export const ENQUIRY_OCCASIONS = [
  { id: "BRIDE", label: "Bride" },
  { id: "BIRTHDAY", label: "Birthday dress" },
  { id: "ANNIVERSARY", label: "Anniversary" },
  { id: "PROM", label: "Prom" },
  { id: "OTHER", label: "Other" },
] as const;

export type EnquiryOccasion = (typeof ENQUIRY_OCCASIONS)[number]["id"];

export function occasionLabel(id: string): string {
  return ENQUIRY_OCCASIONS.find((o) => o.id === id)?.label ?? id;
}

/** How the occasion reads in a sentence: "your enquiry for your wedding on …". */
const OCCASION_PHRASES: Record<EnquiryOccasion, string> = {
  BRIDE: "wedding",
  BIRTHDAY: "birthday",
  ANNIVERSARY: "anniversary",
  PROM: "prom",
  OTHER: "event",
};

export function occasionPhrase(id: string): string {
  return OCCASION_PHRASES[id as EnquiryOccasion] ?? "event";
}

/** How she can attend fittings. */
export const ENQUIRY_FITTING_MODES = [
  { id: "IN_PERSON", label: "In person, at the atelier" },
  { id: "VIRTUAL", label: "Virtually" },
  { id: "BOTH", label: "Either" },
] as const;

export type EnquiryFittingMode = (typeof ENQUIRY_FITTING_MODES)[number]["id"];

export function fittingModeLabel(id: string | null | undefined): string {
  return ENQUIRY_FITTING_MODES.find((m) => m.id === id)?.label ?? (id ?? "");
}

export const MAX_DRESSES = 20;

/** Where an "Other" description from the atelier page waits for the form: session storage, never the URL. */
export const OCCASION_DETAILS_KEY = "atelier-occasion-details";

/**
 * Before 30 September the form asked who would wear it and what kind of outfit.
 * Older enquiries keep those answers; new ones ask the occasion instead.
 */
/** Screening: who will wear it. */
export const ENQUIRY_WEARERS = [
  { id: "BRIDE", label: "I am the bride" },
  { id: "FAMILY", label: "Family of the bride or groom" },
  { id: "GUEST", label: "A guest" },
  { id: "OTHER", label: "Not a wedding / other" },
] as const;

export type EnquiryWearer = (typeof ENQUIRY_WEARERS)[number]["id"];

/** Screening: what kind of outfit. */
export const ENQUIRY_OUTFIT_TYPES = [
  "Wedding gown",
  "Reception dress",
  "Traditional wedding outfit",
  "Engagement outfit",
  "Evening or red-carpet gown",
  "Aso-ebi or guest outfit",
  "Other",
] as const;

export const ENQUIRY_EVENT_TYPES = [
  "White Wedding",
  "Traditional Wedding",
  "Engagement",
  "Wedding Guest",
  "Gala/Red Carpet",
  "AMVCA/Awards",
  "Corporate Event",
  "Birthday",
  "Naming/Dedication",
  "Other",
] as const;

export function wearerLabel(id: string): string {
  return ENQUIRY_WEARERS.find((w) => w.id === id)?.label ?? id;
}

type EnquiryAnswers = {
  enquiryNumber: string;
  eventType: string;
  occasionDetails?: string | null;
  wearer?: string | null;
  outfitType?: string | null;
  dressCount?: number | null;
  eventLocation?: string | null;
  presentCity?: string | null;
  presentState?: string | null;
  presentCountry?: string | null;
  fittingMode?: string | null;
  fittingNote?: string | null;
  deliveryDate?: Date | string | null;
  colourPalette?: string | null;
};

const longDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Her answers as the lines the house reads (booking description, queue).
 * Works for enquiries from before 30 September (wearer, outfit) and after.
 */
export function enquiryAnswerLines(e: EnquiryAnswers): string[] {
  const lines = [
    `Enquiry ${e.enquiryNumber}: ${e.eventType}${e.occasionDetails ? ` (${e.occasionDetails})` : ""}.`,
  ];
  if (e.wearer || e.outfitType) {
    lines.push([e.wearer ? wearerLabel(e.wearer) : null, e.outfitType].filter(Boolean).join("; ") + ".");
  }
  if (e.dressCount) lines.push(`Dresses: ${e.dressCount}.`);
  if (e.eventLocation) lines.push(`Event at: ${e.eventLocation}.`);
  const home = [e.presentCity, e.presentState, e.presentCountry].filter(Boolean).join(", ");
  if (home) lines.push(`Lives in: ${home}.`);
  if (e.fittingMode) {
    lines.push(`Fittings: ${fittingModeLabel(e.fittingMode).toLowerCase()}${e.fittingNote ? `, ${e.fittingNote}` : ""}.`);
  }
  if (e.deliveryDate) lines.push(`Needed by: ${longDate(e.deliveryDate)}.`);
  if (e.colourPalette) lines.push(`Colour palette: ${e.colourPalette}.`);
  return lines;
}

/** Days before the event inside which an enquiry is flagged for a call (setting overrides). */
export const DEFAULT_SHORT_NOTICE_DAYS = 30;
export const SHORT_NOTICE_DAYS_KEY = "consultation_short_notice_days";

/** Whole days from today (WAT) to the event (WAT). Negative = already past. */
export function daysUntil(eventYmd: string, todayYmd: string): number {
  const a = Date.UTC(+eventYmd.slice(0, 4), +eventYmd.slice(5, 7) - 1, +eventYmd.slice(8, 10));
  const b = Date.UTC(+todayYmd.slice(0, 4), +todayYmd.slice(5, 7) - 1, +todayYmd.slice(8, 10));
  return Math.round((a - b) / 86_400_000);
}

/** Flag, never refuse: a close event means the house calls (express fee by phone). */
export function isShortNotice(eventYmd: string, todayYmd: string, days: number): boolean {
  return daysUntil(eventYmd, todayYmd) < days;
}

function naira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

/**
 * The exact non-refundable wording acknowledged at booking. The fee is part of
 * the sentence, so the text snapshotted on the booking says what she agreed to
 * pay. The last sentence restates the house refunds term (Terms, "Consultations").
 */
export function consultationTermsText(feeNGN: number): string {
  return (
    `The consultation fee of ${naira(feeNGN)} is non-refundable. ` +
    "It pays for the consultation only and is not credited towards the price of a commission. " +
    "If the house has to cancel and cannot offer you another date, the fee is returned."
  );
}

export const INVITATION_ONLY_MESSAGE =
  "Consultations are by invitation. Send an enquiry and the house will email you a booking link.";
