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
import { clearVisitorStorage, noteVisitProgress, takeVisitorDay } from "@/lib/analytics/visitor";
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

export function sendNotFound(path: string) {
  post({ event: "not_found", missing: path });
}

/** Visible time on the current page, reported when she leaves it or hides the tab. */
type Dwell = { path: string; ms: number; visibleSince: number | null; reported: boolean };

function takeDwell(d: Dwell | null): { path: string; s: number; first: boolean } | null {
  if (!d) return null;
  const now = Date.now();
  const ms = d.ms + (d.visibleSince != null ? now - d.visibleSince : 0);
  d.ms = 0;
  d.visibleSince = document.visibilityState === "visible" ? now : null;
  const s = Math.round(ms / 1000);
  if (s < 1) return null;
  const first = !d.reported;
  d.reported = true;
  return { path: d.path, s, first };
}

export function PageBeacon() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const dwell = useRef<Dwell | null>(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(hasAnalyticsConsent());
    return onConsentChange((analytics) => {
      setAllowed(analytics);
      if (!analytics) {
        clearHeldAttribution();
        clearVisitorStorage();
        lastPath.current = null;
        dwell.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (!allowed) return;
    function flush() {
      if (!dwell.current) return;
      if (document.visibilityState === "visible") {
        dwell.current.visibleSince ??= Date.now();
        return;
      }
      const piece = takeDwell(dwell.current);
      if (!piece) return;
      const engaged = noteVisitProgress({ dwellSeconds: piece.s });
      post(engaged ? { dwell: piece, engaged } : { dwell: piece });
    }
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !hasAnalyticsConsent()) return;
    if (!pathname || lastPath.current === pathname) return;
    if (isExcludedPath(pathname)) return;
    lastPath.current = pathname;

    const left = takeDwell(dwell.current);
    dwell.current = {
      path: pathname,
      ms: 0,
      visibleSince: document.visibilityState === "visible" ? Date.now() : null,
      reported: false,
    };

    const { attribution, freshLanding } = captureAndHoldFromWindow();
    const payload: Record<string, unknown> = { path: pathname };
    if (freshLanding) {
      payload.landing = true;
      payload.referral = attribution as VisitAttribution;
    }
    const visitor = takeVisitorDay();
    if (visitor) payload.visitor = visitor;
    if (left) payload.dwell = left;
    if (noteVisitProgress({ newPage: true, dwellSeconds: left?.s })) payload.engaged = true;
    post(payload);
  }, [pathname, allowed]);

  return null;
}
