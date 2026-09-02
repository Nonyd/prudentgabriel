import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { jwtIssuedBeforePasswordChange } from "@/lib/password-reset";
import { isGoogleOAuthConfigured } from "@/lib/auth-google";
import { bindSessionUser } from "@/lib/session-user";
import { cachedRoleActorPatch, ensurePermissionCache } from "@/lib/permission-cache";
import { resolveEffectivePermissionSet } from "@/lib/roles";
import { serializePermissionSet } from "@/lib/permission-resolve";
import type { JWT } from "next-auth/jwt";

const jwtUserSelect = {
  id: true,
  isActive: true,
  role: true,
  isStaff: true,
  mustResetPassword: true,
  passwordChangedAt: true,
  jobTitle: true,
  department: true,
  jobRole: { select: { permissions: true } },
  userPermissions: { select: { permission: true, mode: true } },
} as const;

async function attachResolvedPermissions(
  token: JWT,
  dbUser: {
    role: string;
    userPermissions?: { permission: string; mode: string }[];
  },
  email?: string | null,
) {
  const grants = (dbUser.userPermissions ?? [])
    .filter((p) => p.mode === "GRANT")
    .map((p) => p.permission);
  const revokes = (dbUser.userPermissions ?? [])
    .filter((p) => p.mode === "REVOKE")
    .map((p) => p.permission);
  await ensurePermissionCache();
  const resolved = resolveEffectivePermissionSet(dbUser.role, {
    email,
    grants,
    revokes,
    ...cachedRoleActorPatch(dbUser.role),
  });
  token.permissionGrants = grants;
  token.permissionRevokes = revokes;
  token.adminPermissions = serializePermissionSet(resolved);
}

const googleEnabled = isGoogleOAuthConfigured();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
          const password = credentials?.password as string | undefined;
          if (!email || !password) {
            return null;
          }

          const user = await prisma.user.findUnique({
            where: { email },
            include: {
              jobRole: { select: { permissions: true } },
              userPermissions: { select: { permission: true, mode: true } },
            },
          });

          if (!user || !user.password) {
            return null;
          }
          if (user.isActive === false) {
            return null;
          }

          const valid = await bcrypt.compare(password, user.password);
          if (!valid) return null;

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          });

          const { jobRole, userPermissions, ...safeUser } = user;
          delete (safeUser as { password?: string | null }).password;
          return {
            ...safeUser,
            jobRole,
            userPermissions,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (authConfig.callbacks?.jwt) {
        token = await authConfig.callbacks.jwt({ token, user, trigger, session });
      }

      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            role: true,
            isStaff: true,
            mustResetPassword: true,
            passwordChangedAt: true,
            jobTitle: true,
            department: true,
            jobRole: { select: { permissions: true } },
            userPermissions: { select: { permission: true, mode: true } },
          },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isStaff = dbUser.isStaff === true || dbUser.role === "STAFF";
          token.mustResetPassword = dbUser.mustResetPassword;
          token.jobTitle = dbUser.jobTitle ?? undefined;
          token.department = dbUser.department ?? undefined;
          token.jobRolePermissions = dbUser.jobRole?.permissions ?? [];
          await attachResolvedPermissions(token, dbUser, token.email as string | undefined);
        }
      }

      if (!token.role && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { role: true, isStaff: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isStaff = dbUser.isStaff === true || dbUser.role === "STAFF";
        }
      }

      if (trigger !== "signIn") {
        const tokenId = typeof token.id === "string" ? token.id : undefined;
        const tokenEmail =
          typeof token.email === "string" ? token.email.trim().toLowerCase() : "";
        const foundById = tokenId
          ? await prisma.user.findUnique({ where: { id: tokenId }, select: jwtUserSelect })
          : null;
        const foundByEmail =
          !foundById && tokenEmail
            ? await prisma.user.findUnique({ where: { email: tokenEmail }, select: jwtUserSelect })
            : null;
        const bound = bindSessionUser({ foundById, foundByEmail });
        if (!bound) return null;
        if (bound.rebound) {
          token.id = bound.id;
          token.sub = bound.id;
        }
        const dbUser = foundById ?? foundByEmail;
        if (
          dbUser &&
          jwtIssuedBeforePasswordChange(
            typeof token.iat === "number" ? token.iat : undefined,
            dbUser.passwordChangedAt,
          )
        ) {
          return null;
        }
        if (dbUser) {
          token.mustResetPassword = dbUser.mustResetPassword;
          token.isStaff = dbUser.isStaff === true || dbUser.role === "STAFF";
          token.jobTitle = dbUser.jobTitle ?? undefined;
          token.department = dbUser.department ?? undefined;
          token.role = dbUser.role;
          token.jobRolePermissions = dbUser.jobRole?.permissions ?? [];
          await attachResolvedPermissions(token, dbUser, token.email as string | undefined);
        }
      }

      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { mustResetPassword: true },
        });
        if (dbUser) token.mustResetPassword = dbUser.mustResetPassword;
      }

      return token;
    },
  },
});
