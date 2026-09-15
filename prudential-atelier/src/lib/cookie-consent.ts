export const CONSENT_KEY = "pg_cookie_consent";
export const CURRENT_CONSENT_VERSION = "2.0";

/** Bag and currency are essential: the shop cannot work without them. */
export const ESSENTIAL_CART_STORAGE_KEY = "pa-cart";
export const ESSENTIAL_CURRENCY_STORAGE_KEY = "pa-currency";

/** Shared by the banner and the cookie policy token. Do not duplicate this sentence. */
export const COOKIE_BANNER_NOTICE =
  "This site uses cookies to keep you signed in, hold your bag and remember your currency. Nothing else.";

export const COOKIE_BANNER_ACKNOWLEDGE = "Acknowledge";

export type CookieConsent = {
  version: string;
  timestamp: string;
  acknowledged: true;
};

export function parseCookieConsent(raw: unknown): CookieConsent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { version?: unknown; timestamp?: unknown; acknowledged?: unknown };
  if (row.version !== CURRENT_CONSENT_VERSION) return null;
  if (row.acknowledged !== true) return null;
  if (typeof row.timestamp !== "string" || !row.timestamp) return null;
  return { version: CURRENT_CONSENT_VERSION, timestamp: row.timestamp, acknowledged: true };
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

export function acknowledgeCookieNotice(): CookieConsent {
  const stored: CookieConsent = {
    version: CURRENT_CONSENT_VERSION,
    timestamp: new Date().toISOString(),
    acknowledged: true,
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(stored));
  return stored;
}

export function needsConsentBanner(): boolean {
  return readCookieConsent() === null;
}
