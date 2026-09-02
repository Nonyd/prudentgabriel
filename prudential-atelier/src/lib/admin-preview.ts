import { cookies } from "next/headers";
import { ADMIN_PREVIEW_COOKIE, EDITABLE_ADMIN_ROLES } from "@/lib/permission-catalog";
import { isSuperAdmin } from "@/lib/roles";

export function previewRoleFromCookieValue(raw: string | undefined | null): string | null {
  if (!raw) return null;
  if (raw === "SUPER_ADMIN") return null;
  if (!(EDITABLE_ADMIN_ROLES as readonly string[]).includes(raw) && raw !== "STAFF") return null;
  return raw;
}

export async function getAdminPreviewRole(sessionRole?: string | null, sessionEmail?: string | null): Promise<string | null> {
  if (!isSuperAdmin(sessionRole, sessionEmail)) return null;
  const jar = await cookies();
  return previewRoleFromCookieValue(jar.get(ADMIN_PREVIEW_COOKIE)?.value);
}

export function previewCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}
