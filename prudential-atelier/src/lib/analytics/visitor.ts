import { hasAnalyticsConsent } from "@/lib/cookie-consent";

/**
 * Returning visitors without a visitor id: the browser keeps only the date of
 * its own last visit (local storage, after "Accept all"). Once a day it tells
 * us "new" or "returning" and how long since last time, as a bucket. We count
 * the answers; nothing that could tell two people apart is sent.
 */
export const VISITOR_STORAGE_KEY = "pa-visitor";
/** This tab's visit: pages seen and whether it already counted as engaged. */
export const VISIT_STORAGE_KEY = "pa-visit";

export const GAP_BUCKETS = ["first", "1d", "2-7d", "8-30d", "30d+"] as const;
export type GapBucket = (typeof GAP_BUCKETS)[number];
export const SCREEN_BUCKETS = ["<375", "375-767", "768-1023", "1024-1439", "1440+"] as const;
export type ScreenBucket = (typeof SCREEN_BUCKETS)[number];

export type VisitorDay = { kind: "new" | "returning"; gap: GapBucket; screen: ScreenBucket };

export function lagosDateString(at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function gapBucket(lastDay: string | null, today: string): GapBucket {
  if (!lastDay) return "first";
  const diff = Math.round((Date.parse(today) - Date.parse(lastDay)) / 86_400_000);
  if (!Number.isFinite(diff) || diff <= 1) return "1d";
  if (diff <= 7) return "2-7d";
  if (diff <= 30) return "8-30d";
  return "30d+";
}

export function screenBucket(width: number): ScreenBucket {
  if (width < 375) return "<375";
  if (width < 768) return "375-767";
  if (width < 1024) return "768-1023";
  if (width < 1440) return "1024-1439";
  return "1440+";
}

/** First page of the Lagos day in this browser → the visitor tick. Otherwise null. */
export function takeVisitorDay(): VisitorDay | null {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return null;
  try {
    const today = lagosDateString();
    const raw = localStorage.getItem(VISITOR_STORAGE_KEY);
    const last = raw ? ((JSON.parse(raw) as { last?: unknown }).last as string | undefined) ?? null : null;
    if (last === today) return null;
    localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify({ last: today }));
    return {
      kind: last ? "returning" : "new",
      gap: gapBucket(last, today),
      screen: screenBucket(window.innerWidth),
    };
  } catch {
    return null;
  }
}

type VisitState = { pages: number; engaged: boolean };

function readVisit(): VisitState {
  try {
    const raw = sessionStorage.getItem(VISIT_STORAGE_KEY);
    const row = raw ? (JSON.parse(raw) as Partial<VisitState>) : {};
    return { pages: Number(row.pages) || 0, engaged: row.engaged === true };
  } catch {
    return { pages: 0, engaged: false };
  }
}

function writeVisit(v: VisitState) {
  try {
    sessionStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

/**
 * A visit is engaged on its second page or after 10 seconds on one.
 * Returns true exactly once per visit — the moment it becomes engaged.
 */
export function noteVisitProgress(input: { newPage?: boolean; dwellSeconds?: number }): boolean {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return false;
  const v = readVisit();
  if (input.newPage) v.pages += 1;
  const qualifies = v.pages >= 2 || (input.dwellSeconds ?? 0) >= 10;
  const fresh = qualifies && !v.engaged;
  if (fresh) v.engaged = true;
  writeVisit(v);
  return fresh;
}

export function clearVisitorStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(VISITOR_STORAGE_KEY);
    sessionStorage.removeItem(VISIT_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}
