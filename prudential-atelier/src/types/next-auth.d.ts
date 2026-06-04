import { DefaultSession, DefaultJWT } from "next-auth";

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
  }
}
