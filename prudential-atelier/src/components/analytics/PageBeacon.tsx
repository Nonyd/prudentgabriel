"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  captureAndHoldFromWindow,
  clearHeldAttribution,
  FUNNEL_ADD_TO_BAG,
  type VisitAttribution,
} from "@/lib/analytics/attribution";
import { isExcludedPath } from "@/lib/analytics/paths";
import { hasAnalyticsConsent, onConsentChange } from "@/lib/cookie-consent";

/** Nothing leaves the browser until she chose "Accept all" on the cookie banner. */
function post(payload: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return;
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/event", blob);
      return;
    }
  } catch {
    /* fall through */
  }
  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

export function sendAddToBagEvent() {
  post({ event: FUNNEL_ADD_TO_BAG });
}

export function sendProductView(productId: string) {
  post({ productId });
}

export function PageBeacon() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(hasAnalyticsConsent());
    return onConsentChange((analytics) => {
      setAllowed(analytics);
      if (!analytics) {
        clearHeldAttribution();
        lastPath.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (!allowed || !hasAnalyticsConsent()) return;
    if (!pathname || lastPath.current === pathname) return;
    if (isExcludedPath(pathname)) return;
    lastPath.current = pathname;
    const { attribution, freshLanding } = captureAndHoldFromWindow();
    const payload: Record<string, unknown> = { path: pathname };
    if (freshLanding) {
      payload.landing = true;
      payload.referral = attribution as VisitAttribution;
    }
    post(payload);
  }, [pathname, allowed]);

  return null;
}
