/** Dotted keys that a parent permission must never unlock. */
export const NEVER_INHERIT_FROM_PARENT: ReadonlySet<string> = new Set(["settings.developer"]);

export type AccessActor = {
  email?: string | null;
  grants?: readonly string[];
  revokes?: readonly string[];
  /** DB-backed role set. When omitted, ROLE_PERMISSIONS is the seed. */
  rolePermissions?: readonly string[] | "*";
  /** Fully resolved set. When set, grants/revokes are not applied again. */
  resolved?: readonly string[] | "*";
};

export type PermissionSource = "from_role" | "granted" | "revoked" | "super_admin";

export function toPermissionSet(value: readonly string[] | "*" | ReadonlySet<string>): ReadonlySet<string> | "*" {
  if (value === "*") return "*";
  if (value instanceof Set) return value;
  return new Set(value);
}

export function serializePermissionSet(value: ReadonlySet<string> | "*"): string[] | "*" {
  if (value === "*") return "*";
  return Array.from(value).sort();
}

export function applyUserOverrides(
  roleSet: ReadonlySet<string> | "*",
  grants: readonly string[] | undefined,
  revokes: readonly string[] | undefined,
): ReadonlySet<string> | "*" {
  if (roleSet === "*") return "*";
  const next = new Set(roleSet);
  for (const g of grants ?? []) next.add(g);
  for (const r of revokes ?? []) next.delete(r);
  return next;
}

export function permissionSetAllows(
  set: ReadonlySet<string> | "*",
  permission: string,
): boolean {
  if (set === "*") return true;
  if (set.has(permission)) return true;
  const dot = permission.indexOf(".");
  if (dot <= 0) return false;
  if (NEVER_INHERIT_FROM_PARENT.has(permission)) return false;
  return set.has(permission.slice(0, dot));
}
