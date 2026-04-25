import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const now = new Date();
  const [members, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.teamInvitation.findMany({
      where: { acceptedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ members, invitations });
}
