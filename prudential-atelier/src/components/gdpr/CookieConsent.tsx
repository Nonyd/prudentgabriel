"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  COOKIE_ACCEPT_ALL_LABEL,
  COOKIE_BANNER_NOTICE,
  COOKIE_ESSENTIAL_ONLY_LABEL,
  needsConsentBanner,
  OPEN_COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  saveCookieConsent,
} from "@/lib/cookie-consent";
import { clearHeldAttribution } from "@/lib/analytics/attribution";

const choiceButton =
  "min-h-[44px] flex-1 rounded-sm border border-choc bg-choc px-4 py-2 font-label text-[12px] font-medium uppercase tracking-[0.12em] text-cream transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-choc sm:flex-none sm:min-w-[9.5rem]";

/**
 * Cookie banner 3.0: essential storage always; anonymous visit counts and the
 * visit's link tags only after "Accept all". Both choices carry equal weight.
 * Reopened by window event "pg:open-cookie-settings" (openCookieSettings()).
 */
export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [current, setCurrent] = useState<boolean | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowBanner(needsConsentBanner());
    const reopen = () => {
      setCurrent(readCookieConsent()?.analytics ?? null);
      setShowBanner(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  // While the banner shows, floating controls (the chat launcher) sit above it.
  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!showBanner || !el) {
      root.style.removeProperty("--cookie-banner-offset");
      return;
    }
    const set = () => root.style.setProperty("--cookie-banner-offset", `${el.offsetHeight + 12}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--cookie-banner-offset");
    };
  }, [showBanner]);

  if (!showBanner) return null;

  const choose = (analytics: boolean) => {
    saveCookieConsent(analytics);
    if (!analytics) clearHeldAttribution();
    setShowBanner(false);
  };

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Cookie choices"
      className="fixed inset-x-3 bottom-3 z-[100] glass-1 glass-panel px-4 py-4 sm:px-6"
    >
      <div className="mx-auto flex min-w-0 max-w-site flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="min-w-0 max-w-2xl">
          <p className="font-body text-[13px] leading-relaxed text-text-dark">
            {COOKIE_BANNER_NOTICE}{" "}
            <Link href="/cookie-policy" className="underline underline-offset-2 hover:text-choc">
              Cookie Policy
            </Link>
          </p>
          {current !== null ? (
            <p className="mt-2 font-label text-[11px] uppercase tracking-[0.12em] text-text-mid">
              Your current choice: {current ? COOKIE_ACCEPT_ALL_LABEL : COOKIE_ESSENTIAL_ONLY_LABEL}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-3">
          <button type="button" onClick={() => choose(false)} className={choiceButton}>
            {COOKIE_ESSENTIAL_ONLY_LABEL}
          </button>
          <button type="button" onClick={() => choose(true)} className={choiceButton}>
            {COOKIE_ACCEPT_ALL_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
