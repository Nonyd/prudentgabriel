import type { AdminPermission } from "@/lib/roles";
import { CMS_ADMIN_PERMISSIONS } from "@/lib/roles";

export function sanitizeUploadFolder(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  return raw.replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 120);
}

/** Folder → permission. Unknown folders are rejected. */
export function permissionForUploadFolder(folder: string): AdminPermission | readonly AdminPermission[] | null {
  const f = folder.toLowerCase();
  if (f.includes("/products") || f.includes("/collections") || f.endsWith("/products")) {
    return "shop.products";
  }
  if (f.includes("/receipts") || f.includes("/payments")) return "payments";
  if (
    f.includes("/gallery") ||
    f.includes("/media") ||
    f.includes("/journal") ||
    f.includes("/blog") ||
    f.includes("/content") ||
    f.includes("/pages") ||
    f.includes("/careers") ||
    f.includes("/consultations") ||
    f.includes("/uploads")
  ) {
    return CMS_ADMIN_PERMISSIONS;
  }
  return null;
}
