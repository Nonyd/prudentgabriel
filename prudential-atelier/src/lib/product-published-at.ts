/** Catalogue publish date — what Newest first sorts on. Independent of curated displayOrder. */

export const FUTURE_PUBLISH_DATE_MESSAGE =
  "Publish date cannot be in the future. Scheduled publishing is not available yet — pick today or earlier.";

/** Calendar-day compare in the runtime timezone (not UTC midnight tricks). */
export function isFuturePublishDate(value: Date, now = new Date()): boolean {
  const a = startOfLocalDay(value);
  const b = startOfLocalDay(now);
  return a.getTime() > b.getTime();
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Resolve the date to store.
 * - Explicit value wins (after future-date check).
 * - First publish with no date → now.
 * - Unpublish keeps the previous date (caller passes existing).
 * - Draft with no date stays null.
 */
export function resolveProductPublishedAt(input: {
  nextPublished: boolean;
  requested: Date | null | undefined;
  existing: Date | null | undefined;
  now?: Date;
}): { ok: true; publishedAt: Date | null } | { ok: false; error: string } {
  const now = input.now ?? new Date();

  if (input.requested != null) {
    if (Number.isNaN(input.requested.getTime())) {
      return { ok: false, error: "Publish date is not valid." };
    }
    if (isFuturePublishDate(input.requested, now)) {
      return { ok: false, error: FUTURE_PUBLISH_DATE_MESSAGE };
    }
    return { ok: true, publishedAt: input.requested };
  }

  if (input.nextPublished) {
    if (input.existing) return { ok: true, publishedAt: input.existing };
    return { ok: true, publishedAt: now };
  }

  return { ok: true, publishedAt: input.existing ?? null };
}

export function publishedAtChanged(
  before: Date | null | undefined,
  after: Date | null | undefined,
): boolean {
  const b = before?.getTime() ?? null;
  const a = after?.getTime() ?? null;
  return b !== a;
}

export function formatPublishedAtForLog(d: Date | null): string {
  if (!d) return "(none)";
  return d.toISOString();
}

/** YYYY-MM-DD for `<input type="date">`. */
export function publishedAtInputValue(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse date-only form values as local noon to avoid UTC day-shift. */
export function parsePublishDateInput(raw: unknown): Date | null {
  if (raw === "" || raw === null || raw === undefined) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const s = String(raw).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
