import { z } from "zod";

/** Visit-scoped only. Not a cookie. Dies with the tab. */
export const ATTRIBUTION_STORAGE_KEY = "pa-visit-attribution";

export const FUNNEL_ADD_TO_BAG = "add_to_bag";

export const GLORY_UTM_NOTE = `To tag a post, add these to the shop link:

/rtw?utm_source=instagram&utm_medium=social&utm_campaign=spring-drop&utm_content=story-1

source is where (instagram). medium is how (social, paid, email). campaign is the name of this effort. content tells two posts in the same campaign apart.

The first landing keeps the tags for that visit. When she orders or books, they are written on that order. No pixel.`;

export type VisitAttribution = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  referrer: string;
  landingPath: string;
};

const empty: VisitAttribution = {
  source: "",
  medium: "",
  campaign: "",
  content: "",
  referrer: "",
  landingPath: "",
};

function clip(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, max).replace(/[\u0000-\u001f]/g, "");
}

export const visitAttributionSchema = z
  .object({
    source: z.string().max(80).optional(),
    medium: z.string().max(80).optional(),
    campaign: z.string().max(120).optional(),
    content: z.string().max(120).optional(),
    referrer: z.string().max(120).optional(),
    landingPath: z.string().max(200).optional(),
  })
  .optional();

export function sanitizeAttribution(raw: unknown): VisitAttribution | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const next: VisitAttribution = {
    source: clip(row.source, 80),
    medium: clip(row.medium, 80),
    campaign: clip(row.campaign, 120),
    content: clip(row.content, 120),
    referrer: clip(row.referrer, 120).toLowerCase(),
    landingPath: clip(row.landingPath, 200),
  };
  if (
    !next.source &&
    !next.medium &&
    !next.campaign &&
    !next.content &&
    !next.referrer &&
    !next.landingPath
  ) {
    return null;
  }
  return next;
}

export function parseUtmSearch(search: string): Pick<VisitAttribution, "source" | "medium" | "campaign" | "content"> {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    source: clip(params.get("utm_source"), 80),
    medium: clip(params.get("utm_medium"), 80),
    campaign: clip(params.get("utm_campaign"), 120),
    content: clip(params.get("utm_content"), 120),
  };
}

export function referrerHost(referrer: string, ownHost?: string): string {
  const value = clip(referrer, 500);
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (ownHost) {
      const own = ownHost.toLowerCase().replace(/^www\./, "");
      if (host === own) return "";
    }
    return host.slice(0, 120);
  } catch {
    return "";
  }
}

export function captureAttribution(input: {
  search: string;
  pathname: string;
  referrer: string;
  ownHost?: string;
  existing?: VisitAttribution | null;
}): { attribution: VisitAttribution; freshLanding: boolean } {
  if (input.existing) {
    return { attribution: input.existing, freshLanding: false };
  }
  const utm = parseUtmSearch(input.search);
  const referrer = utm.source ? "" : referrerHost(input.referrer, input.ownHost);
  const source = utm.source || (referrer ? referrer : "(direct)");
  const attribution: VisitAttribution = {
    source,
    medium: utm.medium,
    campaign: utm.campaign,
    content: utm.content,
    referrer,
    landingPath: clip(input.pathname, 200) || "/",
  };
  return { attribution, freshLanding: true };
}

export function readHeldAttribution(): VisitAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeAttribution(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function holdAttribution(value: VisitAttribution): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

export function captureAndHoldFromWindow(): { attribution: VisitAttribution; freshLanding: boolean } {
  const existing = readHeldAttribution();
  const result = captureAttribution({
    search: window.location.search,
    pathname: window.location.pathname,
    referrer: document.referrer,
    ownHost: window.location.hostname,
    existing,
  });
  if (result.freshLanding) holdAttribution(result.attribution);
  return result;
}

export function attributionLabel(row: {
  source: string;
  medium?: string;
  campaign?: string;
  content?: string;
}): string {
  const parts = [row.source || "(direct)"];
  if (row.campaign) parts.push(row.campaign);
  if (row.content) parts.push(row.content);
  if (row.medium && row.medium !== "social") parts.push(row.medium);
  return parts.join(" · ");
}

export { empty as EMPTY_ATTRIBUTION };
