import { prisma } from "@/lib/prisma";
import { TeamClient } from "@/components/admin/TeamClient";

export default async function AdminTeamPage() {
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

  return <TeamClient initialMembers={members} initialInvitations={invitations} />;
}
