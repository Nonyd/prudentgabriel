import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Dev/diagnostic: verify demo staff account exists and can sign in. */
export async function GET() {
  const email = "tunde.kareem@prudentgabriel.com";
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isStaff: true,
      isActive: true,
      password: true,
    },
  });

  return NextResponse.json({
    email,
    found: Boolean(user),
    canSignIn: Boolean(user?.isActive && user?.password),
    role: user?.role ?? null,
    isStaff: user?.isStaff ?? false,
    isActive: user?.isActive ?? false,
    hasPassword: Boolean(user?.password),
  });
}
