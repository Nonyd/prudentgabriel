import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId")?.trim();
  const role = searchParams.get("role")?.trim();

  try {
    if (orderId) {
      const order = await prisma.bespokeOrder.findUnique({ where: { id: orderId } });
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const staffProfiles = await prisma.staffProfile.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignments: {
          where: { completedAt: null },
          select: { id: true, orderId: true, role: true },
        },
      },
    });

    const suggestions = staffProfiles
      .map((staff) => {
        const activeAssignments = staff.assignments.filter(
          (a) => !role || a.role.toUpperCase() === role.toUpperCase(),
        );
        return {
          staffProfileId: staff.id,
          name: staff.user.name ?? staff.user.email,
          email: staff.user.email,
          department: staff.department,
          skillTags: staff.skillTags,
          activeOrderCount: activeAssignments.length,
          activeAssignments,
        };
      })
      .sort((a, b) => a.activeOrderCount - b.activeOrderCount);

    return NextResponse.json({ suggestions, orderId: orderId ?? null });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "STAFF_SUGGESTIONS",
      message: e instanceof Error ? e.message : "Failed to fetch staff suggestions",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
