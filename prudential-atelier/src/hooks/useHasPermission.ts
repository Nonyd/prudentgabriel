"use client";

import { useSession } from "next-auth/react";
import {
  hasPermission,
  type Permission,
  type PermissionSession,
} from "@/lib/permissions";

export function useHasPermission(permissionKey: Permission): boolean {
  const { data: session } = useSession();
  const permissionSession: PermissionSession = session
    ? {
        user: {
          role: session.user?.role,
          jobRolePermissions: session.user?.jobRolePermissions,
        },
      }
    : null;
  return hasPermission(permissionSession, permissionKey);
}

export { hasPermission };
