import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

const googleEnabled =
  Boolean(process.env.GOOGLE_CLIENT_ID?.length) && Boolean(process.env.GOOGLE_CLIENT_SECRET?.length);

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
            include: { jobRole: { select: { permissions: true } } },
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

          const { jobRole, ...safeUser } = user;
          delete (safeUser as { password?: string | null }).password;
          return {
            ...safeUser,
            jobRole,
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
            jobTitle: true,
            department: true,
            jobRole: { select: { permissions: true } },
          },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isStaff = dbUser.isStaff ?? false;
          token.mustResetPassword = dbUser.mustResetPassword;
          token.jobTitle = dbUser.jobTitle ?? undefined;
          token.department = dbUser.department ?? undefined;
          token.jobRolePermissions = dbUser.jobRole?.permissions ?? [];
        }
      }

      if (!token.role && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { role: true, isStaff: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isStaff = dbUser.isStaff ?? false;
        }
      }

      if (token.id && trigger !== "signIn") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            mustResetPassword: true,
            isStaff: true,
            jobTitle: true,
            department: true,
            role: true,
            jobRole: { select: { permissions: true } },
          },
        });
        if (dbUser) {
          token.mustResetPassword = dbUser.mustResetPassword;
          token.isStaff = dbUser.isStaff ?? false;
          token.jobTitle = dbUser.jobTitle ?? undefined;
          token.department = dbUser.department ?? undefined;
          token.role = dbUser.role;
          token.jobRolePermissions = dbUser.jobRole?.permissions ?? [];
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
