"use client";

import { useEffect, useState } from "react";

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

async function fetchGoogleEnabled(): Promise<boolean> {
  if (cached != null) return cached;
  if (inflight) return inflight;
  inflight = fetch("/api/auth/public-config")
    .then((r) => (r.ok ? r.json() : { google: false }))
    .then((j: { google?: boolean }) => {
      cached = Boolean(j.google);
      inflight = null;
      return cached;
    })
    .catch(() => {
      inflight = null;
      return false;
    });
  return inflight;
}

/** Client hook: Google button stays hidden until the server confirms credentials exist. */
export function useGoogleAuthEnabled(): boolean {
  const [enabled, setEnabled] = useState(cached ?? false);

  useEffect(() => {
    let cancelled = false;
    void fetchGoogleEnabled().then((v) => {
      if (!cancelled) setEnabled(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
