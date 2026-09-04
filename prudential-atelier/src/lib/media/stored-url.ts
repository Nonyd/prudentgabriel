import { z } from "zod";

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Public local `/media/public/...` path, or an absolute http(s) URL (Cloudinary leftovers).
 * Private `/media/private/...` paths are rejected here — those are receipts, not catalogue images.
 */
export function isStoredPublicMediaUrl(url: string): boolean {
  if (typeof url !== "string") return false;
  const v = url.trim();
  if (v.length < 1 || v.length > 2000) return false;
  if (v.includes("..") || v.includes("\\") || v.includes("\0")) return false;
  if (v.startsWith("/media/private/")) return false;
  if (v.startsWith("/media/public/")) return v.length > "/media/public/".length;
  return isHttpUrl(v);
}

export const storedPublicMediaUrlSchema = z
  .string()
  .min(1)
  .max(2000)
  .transform((v) => v.trim())
  .refine(isStoredPublicMediaUrl, { message: "Invalid media URL" });

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
