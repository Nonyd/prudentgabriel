import type { AdminPermission } from "@/lib/roles";
import { CMS_ADMIN_PERMISSIONS } from "@/lib/roles";

export function sanitizeUploadFolder(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  return raw.replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 120);
}

/** Folders the admin UI actually sends. Keep in sync with permissionForUploadFolder. */
export const UI_UPLOAD_FOLDERS = [
  "prudential-atelier/products",
  "prudential-atelier/collections",
  "prudential-atelier/collection-reels",
  "prudential-atelier/receipts",
  "prudential-atelier/careers",
  "prudential-atelier/consultations",
  "prudential-atelier/testimonials",
  "prudential-atelier/avatars/admin",
  "prudential-atelier/avatars/customer",
  "prudential-atelier/uploads",
  "prudent-gabriel/hero",
  "prudent-gabriel/hero-videos",
  "prudent-gabriel/logos",
  "prudent-gabriel/appearance",
  "prudent-gabriel/cms",
  "prudent-gabriel/general",
  "prudent-gabriel/about",
  "prudent-gabriel/gallery/atelier",
  "prudent-gabriel/gallery/bridal",
  "prudent-gabriel/gallery/kids",
  "prudent-gabriel/bespoke-sketches",
  "prudent-gabriel/bespoke-refs",
  "bespoke-stages",
  "bespoke-videos",
] as const;

export type UploadFolderGate = AdminPermission | readonly AdminPermission[] | "portal";

/**
 * Folder → permission. Unknown folders are rejected.
 * `"portal"` means any signed-in admin with a non-empty permission set (own avatar).
 */
export function permissionForUploadFolder(folder: string): UploadFolderGate | null {
  const f = folder.toLowerCase();
  if (f.includes("/products") || f.includes("/collections") || f.includes("collection-reels") || f.endsWith("/products")) {
    return "shop.products";
  }
  if (f.includes("/receipts") || f.includes("/payments")) return "payments";
  if (f.includes("/avatars")) return "portal";
  if (
    f.includes("bespoke-sketch") ||
    f.includes("bespoke-ref") ||
    f.includes("bespoke-stage") ||
    f.includes("bespoke-video") ||
    f === "bespoke-stages" ||
    f === "bespoke-videos"
  ) {
    return "bespoke";
  }
  if (f.includes("/consultations")) return "consultations";
  if (f.includes("/careers")) return "staff";
  if (
    f.includes("/gallery") ||
    f.includes("/media") ||
    f.includes("/journal") ||
    f.includes("/blog") ||
    f.includes("/content") ||
    f.includes("/pages") ||
    f.includes("/cms") ||
    f.includes("/appearance") ||
    f.includes("/logos") ||
    f.includes("/about") ||
    f.includes("/testimonials") ||
    f.includes("/uploads") ||
    f.includes("/hero") ||
    f.includes("/general")
  ) {
    return CMS_ADMIN_PERMISSIONS;
  }
  return null;
}

export function folderIsPrivate(folder: string): boolean {
  const f = folder.toLowerCase();
  return (
    f.includes("/receipts") ||
    f.includes("/payments") ||
    f.includes("/careers") ||
    f.includes("/moodboard") ||
    f.includes("/consultations")
  );
}
