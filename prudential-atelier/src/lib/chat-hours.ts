/**
 * Slice BF2 — when chat is staffed. A weekly schedule in Lagos time (per day,
 * open and close), plus the dates the house is closed. Client-safe: no server
 * imports, so the widget and the admin editor share the arithmetic.
 *
 * Fails closed, like `atelier_bookings_enabled`: an unset or unreadable
 * schedule means closed, never open. "When it opens next" is computed from the
 * schedule, never typed into a field that goes stale.
 */

/** Lagos keeps West Africa Time all year: UTC+1, no daylight saving. */
export const LAGOS_OFFSET_MIN = 60;
export const LAGOS_TZ = "Africa/Lagos";

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

/** One day's hours, "HH:MM" 24-hour Lagos time; close after open. Null: closed all day. */
export type DayHours = { open: string; close: string } | null;
export type WeeklySchedule = Record<Weekday, DayHours>;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** A schedule from its stored JSON, or null when unset or unreadable (= closed). */
export function parseSchedule(raw: string | null | undefined): WeeklySchedule | null {
  if (!raw?.trim()) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  return scheduleError(v) ? null : (v as WeeklySchedule);
}

/** Why a schedule cannot be saved, or null if it can. */
export function scheduleError(v: unknown): string | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return "The schedule must list every day.";
  const o = v as Record<string, unknown>;
  for (const d of WEEKDAYS) {
    if (!(d in o)) return `${WEEKDAY_LABEL[d]} is missing.`;
    const h = o[d];
    if (h === null) continue;
    if (!h || typeof h !== "object") return `${WEEKDAY_LABEL[d]}: give opening and closing times, or mark it closed.`;
    const { open, close } = h as { open?: unknown; close?: unknown };
    if (typeof open !== "string" || typeof close !== "string" || !HHMM.test(open) || !HHMM.test(close)) {
      return `${WEEKDAY_LABEL[d]}: times are HH:MM, 24-hour.`;
    }
    if (minutesOf(close) <= minutesOf(open)) return `${WEEKDAY_LABEL[d]}: closing must be after opening.`;
  }
  if (Object.keys(o).some((k) => !(WEEKDAYS as readonly string[]).includes(k))) return "Unknown day in the schedule.";
  return null;
}

/** Closed dates ("YYYY-MM-DD", Lagos calendar), deduplicated and sorted. Unreadable → []. */
export function parseClosedDates(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return Array.from(new Set(v.filter((d): d is string => typeof d === "string" && isRealDate(d)))).sort();
  } catch {
    return [];
  }
}

export function isRealDate(d: string): boolean {
  if (!ISO_DATE.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

/** The Lagos wall clock for an instant. */
function lagosClock(at: Date): { date: string; weekday: Weekday; minute: number } {
  const shifted = new Date(at.getTime() + LAGOS_OFFSET_MIN * 60_000);
  return {
    date: shifted.toISOString().slice(0, 10),
    weekday: WEEKDAYS[shifted.getUTCDay()],
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** The instant a Lagos date + minute-of-day falls on. */
function lagosInstant(date: string, minute: number): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) + (minute - LAGOS_OFFSET_MIN) * 60_000);
}

function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Open right now? Null schedule → closed (fails closed). */
export function isOpenAt(schedule: WeeklySchedule | null, closedDates: readonly string[], at: Date): boolean {
  if (!schedule) return false;
  const c = lagosClock(at);
  if (closedDates.includes(c.date)) return false;
  const h = schedule[c.weekday];
  if (!h) return false;
  return c.minute >= minutesOf(h.open) && c.minute < minutesOf(h.close);
}

/**
 * The next instant chat opens (strictly after `at` if closed now), or null when
 * nothing in the coming year is open — an unset schedule, or every day closed.
 */
export function nextOpening(schedule: WeeklySchedule | null, closedDates: readonly string[], at: Date): Date | null {
  if (!schedule) return null;
  const c = lagosClock(at);
  for (let i = 0; i <= 370; i++) {
    const date = addDays(c.date, i);
    if (closedDates.includes(date)) continue;
    const h = schedule[WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]];
    if (!h) continue;
    const open = minutesOf(h.open);
    if (i === 0 && c.minute >= open) continue; // already past (or inside) today's opening
    return lagosInstant(date, open);
  }
  return null;
}

/** When it closes today, if open now. */
export function closesAt(schedule: WeeklySchedule | null, at: Date): Date | null {
  if (!schedule) return null;
  const c = lagosClock(at);
  const h = schedule[c.weekday];
  return h ? lagosInstant(c.date, minutesOf(h.close)) : null;
}

/** "Monday at 9:00" / "tomorrow at 9:00" / "today at 14:00", in Lagos time. */
export function describeOpening(opens: Date | null, now: Date): string | null {
  if (!opens) return null;
  const a = lagosClock(now);
  const b = lagosClock(opens);
  const time = b.minute === 0 ? "midnight" : `${Math.floor(b.minute / 60)}:${String(b.minute % 60).padStart(2, "0")}`;
  if (b.date === a.date) return `today at ${time}`;
  if (b.date === addDays(a.date, 1)) return `tomorrow at ${time}`;
  const days = (Date.parse(`${b.date}T00:00:00Z`) - Date.parse(`${a.date}T00:00:00Z`)) / 86_400_000;
  if (days < 7) return `${WEEKDAY_LABEL[b.weekday]} at ${time}`;
  const label = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${b.date}T00:00:00Z`),
  );
  return `${label} at ${time}`;
}

/** Monday–Friday 9–6, Saturday 10–4, Sunday closed: a starting point for the editor, never applied unasked. */
export const SUGGESTED_SCHEDULE: WeeklySchedule = {
  sun: null,
  mon: { open: "09:00", close: "18:00" },
  tue: { open: "09:00", close: "18:00" },
  wed: { open: "09:00", close: "18:00" },
  thu: { open: "09:00", close: "18:00" },
  fri: { open: "09:00", close: "18:00" },
  sat: { open: "10:00", close: "16:00" },
};
