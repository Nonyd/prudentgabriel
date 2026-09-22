import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { jwtIssuedBeforePasswordChange } from "@/lib/password-reset";
import { sessionRevokedGlobally } from "@/lib/session-revocation";
import { isGoogleOAuthConfigured } from "@/lib/auth-google";
import { bindSessionUser } from "@/lib/session-user";
import { cachedRoleActorPatch, ensurePermissionCache } from "@/lib/permission-cache";
import { resolveEffectivePermissionSet } from "@/lib/roles";
import { serializePermissionSet } from "@/lib/permission-resolve";
import { logError, logServerError } from "@/lib/logger";
import type { JWT } from "next-auth/jwt";

/** "margaret@prudentgabriel.com" → "m***@prudentgabriel.com": enough to spot a wrong address, not a directory of emails. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return domain ? `${local.slice(0, 1)}***@${domain}` : "***";
}

/** Why a credentials sign-in was refused, for the admin error log. Never logs the password. */
async function recordSignInRefusal(
  reason: "NO_ACCOUNT" | "NO_PASSWORD_SET" | "DEACTIVATED" | "WRONG_PASSWORD",
  email: string,
  userId?: string,
): Promise<void> {
  await logError({
    severity: "INFO",
    errorType: `AUTH_SIGNIN_${reason}`,
    message: `Sign-in refused (${reason}) for ${maskEmail(email)}`,
    userId,
  }).catch(() => {});
}

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

const nextAuth = NextAuth({
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

          if (!user) {
            await recordSignInRefusal("NO_ACCOUNT", email);
            return null;
          }
          if (!user.password) {
            await recordSignInRefusal("NO_PASSWORD_SET", email, user.id);
            return null;
          }
          if (user.isActive === false) {
            await recordSignInRefusal("DEACTIVATED", email, user.id);
            return null;
          }

          const valid = await bcrypt.compare(password, user.password);
          if (!valid) {
            await recordSignInRefusal("WRONG_PASSWORD", email, user.id);
            return null;
          }

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
        } catch (e) {
          // A server error must not masquerade silently as a wrong password.
          await logServerError({ errorType: "AUTH_SIGNIN_ERROR", error: e });
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      try {
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
          // Slice AZ9: a SUPER_ADMIN "sign out everyone" drops every session issued before it.
          if (await sessionRevokedGlobally(typeof token.iat === "number" ? token.iat : undefined)) {
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
      } catch (err) {
        void logServerError({ errorType: "AUTH_JWT", error: err });
        return null;
      }
    },
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;

/** Layouts must not throw a Next.js digest when the session cookie is stale. */
export async function authOrNull() {
  try {
    return await auth();
  } catch {
    return null;
  }
}
