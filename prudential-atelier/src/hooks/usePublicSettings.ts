"use client";

import { useEffect, useState } from "react";

let cached: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

async function fetchPublic(): Promise<Record<string, string>> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = fetch("/api/settings/public")
    .then((r) => (r.ok ? r.json() : {}))
    .then((j: Record<string, string>) => {
      cached = j ?? {};
      inflight = null;
      return cached;
    })
    .catch(() => {
      inflight = null;
      return {};
    });
  return inflight;
}

export function usePublicSettings(): Record<string, string> {
  const [data, setData] = useState<Record<string, string>>(cached ?? {});

  useEffect(() => {
    let cancelled = false;
    void fetchPublic().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}

export function getSettingFromPublic(store: Record<string, string>, key: string, fallback: string): string {
  const v = store[key];
  return v && v.trim().length > 0 ? v : fallback;
}
