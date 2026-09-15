"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  acknowledgeCookieNotice,
  COOKIE_BANNER_ACKNOWLEDGE,
  COOKIE_BANNER_NOTICE,
  needsConsentBanner,
} from "@/lib/cookie-consent";

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    setShowBanner(needsConsentBanner());
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] glass-1 glass-panel px-4 py-4 sm:px-6">
      <div className="mx-auto flex min-w-0 max-w-site flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p
          className="max-w-2xl leading-relaxed"
          style={{ fontFamily: "var(--font-lora)", fontSize: "13px", color: "var(--text-primary)" }}
        >
          {COOKIE_BANNER_NOTICE}{" "}
          <Link href="/cookie-policy" className="underline hover:text-choc">
            Cookie Policy
          </Link>
        </p>
        <button
          type="button"
          onClick={() => {
            acknowledgeCookieNotice();
            setShowBanner(false);
          }}
          className="shrink-0 rounded-sm bg-choc px-4 py-2 font-sans text-[13px] font-normal text-cream transition-opacity hover:opacity-90"
        >
          {COOKIE_BANNER_ACKNOWLEDGE}
        </button>
      </div>
    </div>
  );
}
