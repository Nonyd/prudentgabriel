import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe Auth.js config (no Prisma adapter). Used by middleware and as the
 * base for the full server auth instance in auth.ts.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = (user as { role: Role }).role;
        const role = (user as { role: Role }).role;
        token.isStaff = (user as { isStaff?: boolean }).isStaff === true || role === "STAFF";
        token.mustResetPassword = (user as { mustResetPassword?: boolean }).mustResetPassword ?? false;
        token.referralCode = (user as { referralCode?: string }).referralCode ?? "";
        token.pointsBalance = (user as { pointsBalance?: number }).pointsBalance ?? 0;
        token.jobRolePermissions =
          (user as { jobRole?: { permissions: string[] } | null }).jobRole?.permissions ?? [];
        token.name = user.name;
        token.picture = user.image;
        token.jobTitle = (user as { jobTitle?: string | null }).jobTitle ?? undefined;
        token.department = (user as { department?: string | null }).department ?? undefined;
      }

      if (trigger === "update" && session) {
        const patch = session as { name?: string; image?: string; email?: string };
        if (patch.name !== undefined) token.name = patch.name;
        if (patch.image !== undefined) token.picture = patch.image;
        if (patch.email !== undefined) token.email = patch.email;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isStaff = Boolean(token.isStaff);
        session.user.jobTitle = token.jobTitle as string | undefined;
        session.user.department = token.department as string | undefined;
        session.user.referralCode = token.referralCode as string;
        session.user.pointsBalance = token.pointsBalance as number;
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
        if (token.picture) session.user.image = token.picture as string;
        session.user.mustResetPassword = Boolean(token.mustResetPassword);
        session.user.jobRolePermissions = (token.jobRolePermissions as string[] | undefined) ?? [];
        session.user.permissionGrants = (token.permissionGrants as string[] | undefined) ?? [];
        session.user.permissionRevokes = (token.permissionRevokes as string[] | undefined) ?? [];
        session.user.adminPermissions = (token.adminPermissions as string[] | "*" | undefined) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

/** Edge middleware auth — reads the same session cookie as server auth(). */
export const { auth } = NextAuth(authConfig);
