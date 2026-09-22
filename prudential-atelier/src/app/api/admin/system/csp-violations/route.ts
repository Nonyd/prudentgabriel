import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

/**
 * Aggregated CSP report-only violations (Slice AZ4), most recent first.
 * Read this before switching the policy from report-only to enforced.
 */
export async function GET() {
  const gate = await requireAdminApi("settings.developer");
  if (!gate.ok) return gate.response;

  const rows = await prisma.cspViolation.findMany({
    orderBy: [{ lastSeenAt: "desc" }],
    take: 500,
    select: {
      directive: true,
      blockedOrigin: true,
      documentPath: true,
      count: true,
      firstSeenAt: true,
      lastSeenAt: true,
    },
  });
  return NextResponse.json({ violations: rows });
}
