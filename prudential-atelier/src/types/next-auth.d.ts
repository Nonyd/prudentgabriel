import { DefaultSession, DefaultJWT } from "next-auth";
import type { ViewAsSessionInfo } from "@/lib/client-view-as-rules";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: string;
      isStaff?: boolean;
      jobTitle?: string;
      department?: string;
      referralCode?: string;
      pointsBalance?: number;
      mustResetPassword?: boolean;
      jobRolePermissions?: string[];
      permissionGrants?: string[];
      permissionRevokes?: string[];
      adminPermissions?: string[] | "*";
      /** Set while an admin is viewing as this client ("View as client"). */
      viewAs?: ViewAsSessionInfo;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    referralCode: string;
    pointsBalance: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: string;
    isStaff?: boolean;
    jobTitle?: string;
    department?: string;
    referralCode?: string;
    pointsBalance?: number;
    mustResetPassword?: boolean;
    jobRolePermissions?: string[];
    permissionGrants?: string[];
    permissionRevokes?: string[];
    adminPermissions?: string[] | "*";
    /** The admin behind a "View as client" session (ViewAsClaim in lib/client-view-as.ts). */
    viewAs?: unknown;
  }
}
