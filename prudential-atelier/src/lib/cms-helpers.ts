import { getFieldDefault } from "@/lib/cms-config";

/** Read CMS value with hardcoded fallback when empty or missing. */
export function cmsGet(cms: Record<string, string>, key: string, fallback?: string): string {
  const v = cms[key];
  if (v != null && String(v).trim().length > 0) return v;
  return fallback ?? getFieldDefault(key);
}

export function cmsBool(cms: Record<string, string>, key: string, fallback = true): boolean {
  const v = cmsGet(cms, key, fallback ? "true" : "false");
  return v === "true" || v === "1";
}

export function cmsJson<T>(cms: Record<string, string>, key: string, fallback: T): T {
  const raw = cms[key];
  if (!raw?.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const ANNOUNCEMENT_SPEED_MS: Record<string, number> = {
  slow: 5000,
  medium: 3000,
  fast: 2000,
};
