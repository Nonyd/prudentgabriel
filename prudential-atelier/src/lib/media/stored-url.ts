import { z } from "zod";
import { isValidMediaKey, keyFromMediaUrl } from "@/lib/media/key-parse";

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeMediaString(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const v = url.trim();
  return v.length >= 1 && v.length <= 2000 && !v.includes("..") && !v.includes("\\") && !v.includes("\0");
}

/**
 * Public local `/media/public/...` path, or an absolute http(s) URL (Cloudinary leftovers).
 * Private `/media/private/...` paths are rejected here — those are receipts, not catalogue images.
 */
export function isStoredPublicMediaUrl(url: string): boolean {
  if (!isSafeMediaString(url)) return false;
  const v = url.trim();
  if (v.startsWith("/media/private/")) return false;
  if (v.startsWith("/media/public/")) return v.length > "/media/public/".length;
  return isHttpUrl(v);
}

/**
 * Private local `/media/private/...` path, or an absolute http(s) URL (Cloudinary leftovers).
 * Relative `/media/` paths are not valid `z.string().url()` values.
 */
export function isStoredPrivateMediaUrl(url: string): boolean {
  if (!isSafeMediaString(url)) return false;
  const v = url.trim();
  if (v.startsWith("/media/public/")) return false;
  const key = keyFromMediaUrl(v);
  if (key && isValidMediaKey(key) && key.startsWith("private/")) return true;
  return isHttpUrl(v);
}

/** Receipts, CVs, consultation stills — same shape after Slice X. */
export const isStoredReceiptMediaUrl = isStoredPrivateMediaUrl;

/** Public or private local path, or leftover https. */
export function isStoredMediaUrl(url: string): boolean {
  return isStoredPublicMediaUrl(url) || isStoredPrivateMediaUrl(url);
}

export const storedPublicMediaUrlSchema = z
  .string()
  .min(1)
  .max(2000)
  .transform((v) => v.trim())
  .refine(isStoredPublicMediaUrl, { message: "Invalid media URL" });

export const storedPrivateMediaUrlSchema = z
  .string()
  .min(1)
  .max(2000)
  .transform((v) => v.trim())
  .refine(isStoredPrivateMediaUrl, { message: "Invalid media URL" });

export const storedMediaUrlSchema = z
  .string()
  .min(1)
  .max(2000)
  .transform((v) => v.trim())
  .refine(isStoredMediaUrl, { message: "Invalid media URL" });

export const receiptMediaUrlSchema = storedPrivateMediaUrlSchema;

/** Empty, null, `/media/public/...`, or http(s). Safe for react-hook-form. */
export const optionalStoredPublicMediaUrlSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val == null) return null;
    const t = val.trim();
    return t === "" ? null : t;
  })
  .refine((val) => val === null || isStoredPublicMediaUrl(val), {
    message: "Use a /media/ path or an https image URL",
  });

/** Empty string, omitted, `/media/public/...`, or http(s). Matches `.optional().or("")` avatar fields. */
export const emptyableStoredPublicMediaUrlSchema = z
  .union([z.string(), z.undefined()])
  .transform((val) => (val == null ? undefined : val.trim()))
  .refine((val) => val === undefined || val === "" || isStoredPublicMediaUrl(val), {
    message: "Invalid media URL",
  });

export const optionalStoredPrivateMediaUrlSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val == null) return null;
    const t = val.trim();
    return t === "" ? null : t;
  })
  .refine((val) => val === null || isStoredPrivateMediaUrl(val), {
    message: "Use a /media/ path or an https file URL",
  });
