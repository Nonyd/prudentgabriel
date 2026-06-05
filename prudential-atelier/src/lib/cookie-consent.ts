export const CONSENT_KEY = "pg_cookie_consent";
export const CURRENT_CONSENT_VERSION = "1.0";

export type CookieConsent = {
  version: string;
  timestamp: string;
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
}

export function saveCookieConsent(consent: Omit<CookieConsent, "timestamp"> & { timestamp?: string }): CookieConsent {
  const stored: CookieConsent = {
    ...consent,
    necessary: true,
    timestamp: consent.timestamp ?? new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(stored));
  return stored;
}

export function acceptAllConsent(): CookieConsent {
  return saveCookieConsent({
    version: CURRENT_CONSENT_VERSION,
    necessary: true,
    functional: true,
    analytics: true,
    marketing: true,
  });
}

export function rejectNonEssentialConsent(): CookieConsent {
  return saveCookieConsent({
    version: CURRENT_CONSENT_VERSION,
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });
}

export function needsConsentBanner(): boolean {
  const consent = readCookieConsent();
  if (!consent) return true;
  return consent.version !== CURRENT_CONSENT_VERSION;
}
