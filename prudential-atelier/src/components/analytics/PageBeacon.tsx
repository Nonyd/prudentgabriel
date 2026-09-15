"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { captureAndHoldFromWindow, FUNNEL_ADD_TO_BAG, type VisitAttribution } from "@/lib/analytics/attribution";
import { isExcludedPath } from "@/lib/analytics/paths";

function post(payload: Record<string, unknown>) {
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

  useEffect(() => {
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
  }, [pathname]);

  return null;
}
