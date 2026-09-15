"use client";

import { useSession } from "next-auth/react";
import { hasPermission, type AdminPermission } from "@/lib/roles";
import { accessActorFromUser } from "@/lib/login-paths";

/** Catalogue/admin permission from the resolved JWT set, not the old JobRole list. */
export function useHasPermission(permissionKey: AdminPermission): boolean {
  const { data: session } = useSession();
  if (!session?.user?.role) return false;
  return hasPermission(session.user.role, permissionKey, accessActorFromUser(session.user));
}

export { hasPermission };
