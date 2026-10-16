import NextAuth, { CredentialsSignin } from "next-auth";
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
import { SIGNIN_SERVER_ERROR_CODE } from "@/lib/signin-errors";
import { beginViewAs, endViewAs, readViewAsClaim, viewAsActorStillValid } from "@/lib/client-view-as";
import type { JWT } from "next-auth/jwt";

/**
 * A sign-in that failed on our side (database down, bug), not a wrong password.
 * The client gets error=CredentialsSignin&code=server_error and says to retry,
 * instead of telling someone with the right password that it is wrong.
 */
class SignInUnavailable extends CredentialsSignin {
  code = SIGNIN_SERVER_ERROR_CODE;
}

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
          // A server error must not masquerade as a wrong password.
          await logServerError({ errorType: "AUTH_SIGNIN_ERROR", error: e });
          throw new SignInUnavailable();
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

        // "View as client" (lib/client-view-as.ts): begins only on a ticket the
        // view-as route signed for this admin; ends on Exit or after the hour.
        if (trigger === "update" && session) {
          const data = session as { viewAs?: unknown; viewAsEnd?: unknown };
          if (data.viewAsEnd === true) endViewAs(token);
          else if (data.viewAs !== undefined) await beginViewAs(token, data.viewAs);
        }
        const expiredViewAs = readViewAsClaim(token);
        if (expiredViewAs && expiredViewAs.exp <= Date.now()) endViewAs(token);

        if (trigger !== "signIn") {
          const viewAs = readViewAsClaim(token);
          if (viewAs) {
            // The admin is still answerable for this session: if they could not sign in now, it ends.
            if (!(await viewAsActorStillValid(viewAs, typeof token.iat === "number" ? token.iat : undefined))) {
              return null;
            }
            const client = await prisma.user.findUnique({
              where: { id: viewAs.targetUserId },
              select: { isActive: true, role: true },
            });
            if (!client?.isActive || client.role !== "CUSTOMER") endViewAs(token);
          }

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
          // While viewing as a client the token was issued to the admin; their password was checked above.
          if (
            dbUser &&
            !readViewAsClaim(token) &&
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
  events: {
    // A first Google sign-in creates her account: the founder's note follows ten minutes later.
    async createUser({ user }) {
      if (!user?.id || !user.email) return;
      const { scheduleFounderNote } = await import("@/lib/founder-note");
      await scheduleFounderNote({ id: user.id, email: user.email, name: user.name });
    },
    // BF4: chats she started as a guest under this email join her account the moment she signs in.
    async signIn({ user, account, profile }) {
      if (!user?.id || !user.email) return;
      const { markEmailVerified, provenEmail } = await import("@/lib/email-verification");
      // Google has already checked the address belongs to her.
      if (account?.provider === "google" && (profile as { email_verified?: boolean } | undefined)?.email_verified) {
        await markEmailVerified(user.id).catch((error) => logServerError({ errorType: "EMAIL_VERIFY_GOOGLE", error }));
      }
      // Guest chats join only an account that has proven the email they were left under.
      const email = await provenEmail(user.id);
      if (!email) return;
      const { mergeGuestChats } = await import("@/lib/chat-visitor");
      await mergeGuestChats(user.id, email).catch((error) => logServerError({ errorType: "CHAT_MERGE", error }));
    },
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;

/** Server-side session update (re-runs the JWT callback with `trigger: "update"`). */
export const updateSession = nextAuth.unstable_update;

/** Layouts must not throw a Next.js digest when the session cookie is stale. */
export async function authOrNull() {
  try {
    return await auth();
  } catch {
    return null;
  }
}
