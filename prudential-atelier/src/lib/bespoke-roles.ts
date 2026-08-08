import { isSuperAdmin } from "@/lib/roles";

/** Floor + managers: complete stages, media, drafts, request approval, read. */
export const BESPOKE_STAFF_ROLES = [
  "BESPOKE_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
  "STAFF_ADMIN",
  "STAFF",
];

/** Managers: create orders, edit totals/identity, assign staff, record payments. Not STAFF. */
export const BESPOKE_MANAGER_ROLES = ["BESPOKE_MANAGER", "ADMIN", "SUPER_ADMIN", "STAFF_ADMIN"];

/** Admin only: revert a stage, delete an order. */
export const BESPOKE_ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

/** @deprecated Prefer BESPOKE_STAFF_ROLES / BESPOKE_MANAGER_ROLES / BESPOKE_ADMIN_ROLES. */
export const BESPOKE_ROLES = BESPOKE_STAFF_ROLES;

export function sessionHasRole(
  role: string | null | undefined,
  email: string | null | undefined,
  allowed: string[],
): boolean {
  const r = role ?? "";
  if (r === "SUPER_ADMIN" || isSuperAdmin(r, email)) return true;
  if (r === "ADMIN" && allowed.includes("ADMIN")) return true;
  return allowed.includes(r);
}
