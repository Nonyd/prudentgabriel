import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/** Same GRANT on several people is a sign the role is wrong. */
export async function GET() {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const rows = await prisma.userPermission.findMany({
    where: { mode: "GRANT" },
    select: {
      permission: true,
      user: { select: { email: true, role: true, name: true } },
    },
  });

  const grouped = new Map<string, { permission: string; count: number; emails: string[]; roles: string[] }>();
  for (const row of rows) {
    const current = grouped.get(row.permission) ?? {
      permission: row.permission,
      count: 0,
      emails: [],
      roles: [],
    };
    current.count += 1;
    current.emails.push(row.user.email);
    current.roles.push(row.user.role);
    grouped.set(row.permission, current);
  }

  const items = Array.from(grouped.values()).filter((g) => g.count >= 2);
  return NextResponse.json({ items });
}
