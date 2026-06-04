import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  try {
    const profile = await getOrCreateClientProfile(gate.session.user.id!);
    const orders = await prisma.bespokeOrder.findMany({
      where: { clientProfileId: profile.id },
      orderBy: { createdAt: "desc" },
      include: {
        stageHistory: { orderBy: { completedAt: "desc" } },
      },
    });
    return NextResponse.json({ orders });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_BESPOKE_ORDERS",
      message: e instanceof Error ? e.message : "Failed to list bespoke orders",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
