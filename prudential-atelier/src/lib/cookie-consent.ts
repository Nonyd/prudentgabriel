export const CONSENT_KEY = "pg_cookie_consent";
/**
 * 3.0 (NDPA 2023 / ePrivacy): the banner offers a real choice — anonymous visit
 * counts and "which link brought you here" run only after "Accept all". Anything
 * stored under an older version (the 2.x notice-only acknowledgement) carries no
 * analytics choice, so the banner shows again.
 */
export const CURRENT_CONSENT_VERSION = "3.0";

/** Bag and currency are essential: the shop cannot work without them. */
export const ESSENTIAL_CART_STORAGE_KEY = "pa-cart";
export const ESSENTIAL_CURRENCY_STORAGE_KEY = "pa-currency";

/** Shared by the banner and the cookie policy token. Do not duplicate this sentence. */
export const COOKIE_BANNER_NOTICE =
  "We use essential storage to keep you signed in, hold your bag, remember your currency and, if you start a chat, keep that conversation open. With your permission we also count visits anonymously and note which link brought you here, to understand what works. No advertising trackers.";

export const COOKIE_ACCEPT_ALL_LABEL = "Accept all";
export const COOKIE_ESSENTIAL_ONLY_LABEL = "Essential only";
/** The banner's two equal choices, as the cookie policy names them. */
export const COOKIE_BANNER_ACKNOWLEDGE = `${COOKIE_ACCEPT_ALL_LABEL} / ${COOKIE_ESSENTIAL_ONLY_LABEL}`;
export const COOKIE_SETTINGS_LABEL = "Cookie settings";

/** Fired on window whenever the choice is saved. detail: { analytics: boolean }. */
export const CONSENT_CHANGED_EVENT = "pg:consent-changed";
/** Dispatch on window (or call openCookieSettings) to show the banner again. */
export const OPEN_COOKIE_SETTINGS_EVENT = "pg:open-cookie-settings";

export type CookieConsent = {
  version: string;
  timestamp: string;
  analytics: boolean;
};

export type ConsentChangedDetail = { analytics: boolean };

function majorVersion(v: string): number {
  const n = Number.parseInt(v.split(".")[0] ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

/** Null when there is no current choice (missing, malformed, or older than 3.x). */
export function parseCookieConsent(raw: unknown): CookieConsent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { version?: unknown; timestamp?: unknown; analytics?: unknown };
  if (typeof row.version !== "string" || majorVersion(row.version) < majorVersion(CURRENT_CONSENT_VERSION)) {
    return null;
  }
  if (typeof row.analytics !== "boolean") return null;
  if (typeof row.timestamp !== "string" || !row.timestamp) return null;
  return { version: row.version, timestamp: row.timestamp, analytics: row.analytics };
}

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return parseCookieConsent(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** True only after she chose "Accept all". Read fresh each call (another tab may have changed it). */
export function hasAnalyticsConsent(): boolean {
  return readCookieConsent()?.analytics === true;
}

export function saveCookieConsent(analytics: boolean): CookieConsent {
  const stored: CookieConsent = {
    version: CURRENT_CONSENT_VERSION,
    timestamp: new Date().toISOString(),
    analytics,
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(stored));
  } catch {
    /* private mode: the choice holds for this page only */
  }
  try {
    window.dispatchEvent(
      new CustomEvent<ConsentChangedDetail>(CONSENT_CHANGED_EVENT, { detail: { analytics } }),
    );
  } catch {
    /* no window */
  }
  return stored;
}

/** Reopen the banner so she can change her choice (link this from the Cookie Policy). */
export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
}

/** Subscribe to consent changes in this tab and others. Returns an unsubscribe function. */
export function onConsentChange(listener: (analytics: boolean) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const local = (e: Event) => {
    const detail = (e as CustomEvent<ConsentChangedDetail>).detail;
    listener(detail?.analytics === true);
  };
  const otherTab = (e: StorageEvent) => {
    if (e.key === CONSENT_KEY) listener(hasAnalyticsConsent());
  };
  window.addEventListener(CONSENT_CHANGED_EVENT, local);
  window.addEventListener("storage", otherTab);
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, local);
    window.removeEventListener("storage", otherTab);
  };
}

export function needsConsentBanner(): boolean {
  return readCookieConsent() === null;
}
