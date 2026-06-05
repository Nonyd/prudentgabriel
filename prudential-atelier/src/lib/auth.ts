import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const googleEnabled =
  Boolean(process.env.GOOGLE_CLIENT_ID?.length) && Boolean(process.env.GOOGLE_CLIENT_SECRET?.length);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Auth.js v5 reads AUTH_SECRET; many deployments still set NEXTAUTH_SECRET only.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
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
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { jobRole: { select: { permissions: true } } },
        });
        if (!user?.password) return null;
        if (user.isActive === false) return null;

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
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.isStaff = (user as { isStaff?: boolean }).isStaff ?? false;
        token.jobTitle = (user as { jobTitle?: string | null }).jobTitle ?? undefined;
        token.department = (user as { department?: string | null }).department ?? undefined;
        token.referralCode = (user as { referralCode: string }).referralCode;
        token.pointsBalance = (user as { pointsBalance: number }).pointsBalance;
        token.name = user.name;
        token.picture = user.image;
        token.mustResetPassword = (user as { mustResetPassword?: boolean }).mustResetPassword ?? false;

        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            isStaff: true,
            jobTitle: true,
            department: true,
            role: true,
            mustResetPassword: true,
            jobRole: { select: { permissions: true } },
          },
        });
        if (dbUser) {
          token.isStaff = dbUser.isStaff;
          token.jobTitle = dbUser.jobTitle ?? undefined;
          token.department = dbUser.department ?? undefined;
          token.role = dbUser.role;
          token.mustResetPassword = dbUser.mustResetPassword;
          token.jobRolePermissions = dbUser.jobRole?.permissions ?? [];
        } else {
          token.jobRolePermissions =
            (user as { jobRole?: { permissions: string[] } | null }).jobRole?.permissions ?? [];
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
          token.isStaff = dbUser.isStaff;
          token.jobTitle = dbUser.jobTitle ?? undefined;
          token.department = dbUser.department ?? undefined;
          token.role = dbUser.role;
          token.jobRolePermissions = dbUser.jobRole?.permissions ?? [];
        }
      }
      if (trigger === "update") {
        if (session) {
          const patch = session as { name?: string; image?: string };
          if (patch.name !== undefined) token.name = patch.name;
          if (patch.image !== undefined) token.picture = patch.image;
        }
        if (token.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { mustResetPassword: true },
          });
          if (dbUser) token.mustResetPassword = dbUser.mustResetPassword;
        }
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
        if (token.picture) session.user.image = token.picture as string;
        session.user.mustResetPassword = Boolean(token.mustResetPassword);
        session.user.jobRolePermissions = (token.jobRolePermissions as string[] | undefined) ?? [];
      }
      return session;
    },
  },
});
