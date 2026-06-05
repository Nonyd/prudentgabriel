import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encryption";
import type { SettingGroup, SettingType } from "@prisma/client";

let contentSettingsCache: { data: Record<string, string>; expiresAt: number } | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { value: string; expiresAt: number };
const settingCache = new Map<string, CacheEntry>();
let publicSettingsCache: { data: Record<string, string>; expiresAt: number } | null = null;

export function encryptSettingPlaintext(plain: string): string {
  return encrypt(plain);
}

export function decryptSettingCiphertext(stored: string): string {
  return decrypt(stored);
}

function cacheGet(key: string): string | null {
  const e = settingCache.get(key);
  if (!e || Date.now() > e.expiresAt) {
    if (e) settingCache.delete(key);
    return null;
  }
  return e.value;
}

function cacheSet(key: string, value: string) {
  settingCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearSettingCacheKey(key: string) {
  settingCache.delete(key);
}

export function clearPublicSettingsCache() {
  publicSettingsCache = null;
}

export function clearContentSettingsCache() {
  contentSettingsCache = null;
}

export async function getSetting(key: string): Promise<string | null> {
  const cached = cacheGet(key);
  if (cached !== null) return cached;

  const row = await prisma.siteSetting.findUnique({
    where: { key },
    select: { value: true, type: true },
  });
  if (!row) return null;

  let out = row.value;
  if (row.type === "PASSWORD" && row.value.length > 0) {
    try {
      out = decryptSettingCiphertext(row.value);
    } catch {
      out = row.value;
    }
  }
  cacheSet(key, out);
  return out;
}

export async function getSettings(group: SettingGroup): Promise<Record<string, string>> {
  const rows = await prisma.siteSetting.findMany({
    where: { group },
    orderBy: { sortOrder: "asc" },
    select: { key: true, value: true, type: true },
  });
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.type === "PASSWORD" && r.value.length > 0) {
      try {
        out[r.key] = decryptSettingCiphertext(r.value);
      } catch {
        out[r.key] = r.value;
      }
    } else {
      out[r.key] = r.value;
    }
  }
  return out;
}

export async function getPublicSettings(): Promise<Record<string, string>> {
  if (publicSettingsCache && Date.now() < publicSettingsCache.expiresAt) {
    return publicSettingsCache.data;
  }

  const rows = await prisma.siteSetting.findMany({
    where: { isPublic: true, type: { not: "PASSWORD" } },
    select: { key: true, value: true },
  });
  const data: Record<string, string> = {};
  for (const r of rows) {
    data[r.key] = r.value;
  }
  publicSettingsCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export async function setSetting(key: string, value: string, updatedBy: string): Promise<void> {
  const existing = await prisma.siteSetting.findUnique({
    where: { key },
    select: { type: true },
  });
  if (!existing) {
    throw new Error(`Unknown setting key: ${key}`);
  }

  let stored = value;
  if (existing.type === "PASSWORD" && value.length > 0) {
    stored = encryptSettingPlaintext(value);
  }

  await prisma.siteSetting.update({
    where: { key },
    data: { value: stored, updatedBy },
  });
  clearSettingCacheKey(key);
  clearPublicSettingsCache();
  clearContentSettingsCache();
}

export async function getImageSetting(key: string, fallback: string): Promise<string> {
  const v = await getSetting(key);
  return v && v.trim().length > 0 ? v : fallback;
}

const APPEARANCE_IMAGE_KEYS = [
  "logo_dark",
  "logo_white",
  "logo_atelier_dark",
  "logo_atelier_white",
  "logo_bridal_dark",
  "logo_bridal_white",
  "logo_kids_dark",
  "logo_kids_white",
  "img_hero",
  "img_bride_hero",
  "img_bride_portrait",
  "img_bespoke",
  "img_atelier_wide",
  "img_atelier_portrait",
  "img_consultation_hero",
  "img_bespoke_hero",
  "img_collection_bridal",
  "img_collection_evening",
  "img_collection_formal",
  "img_collection_rtw",
  "img_our_story_hero",
  "favicon_url",
  "seo_og_image",
  "img_logo_atelier",
  "img_logo_bridal",
  "img_logo_kids",
] as const;

export async function getContentSettings(): Promise<Record<string, string>> {
  if (contentSettingsCache && Date.now() < contentSettingsCache.expiresAt) {
    return contentSettingsCache.data;
  }

  const rows = await prisma.siteSetting.findMany({
    where: { group: "CONTENT", isPublic: true },
    select: { key: true, value: true },
  });
  const data: Record<string, string> = {};
  for (const r of rows) {
    data[r.key] = r.value;
  }
  contentSettingsCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

/** Use after `await getContentSettings()` — reads from the resolved map. */
export function getContent(settings: Record<string, string>, key: string, fallback: string): string {
  const v = settings[key];
  return v != null && String(v).trim().length > 0 ? v : fallback;
}

export async function getImageSettings(): Promise<Record<string, string>> {
  const rows = await prisma.siteSetting.findMany({
    where: {
      group: "APPEARANCE",
      key: { in: [...APPEARANCE_IMAGE_KEYS] },
    },
    select: { key: true, value: true },
  });
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

export function isPasswordSettingType(t: SettingType): boolean {
  return t === "PASSWORD";
}
