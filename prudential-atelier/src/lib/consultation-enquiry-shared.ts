/**
 * Slice BA2 — consultation by invitation. Client-safe (no server imports):
 * the enquiry form, the booking page and the server all read these.
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
