import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const staff = await prisma.staffProfile.findMany({
    where: { isActive: true },
    include: {
      user: { select: { name: true, jobTitle: true, department: true } },
      performanceRecords: {
        where: { month, year },
        take: 1,
      },
    },
    orderBy: { ordersCompleted: "desc" },
  });

  return NextResponse.json({
    items: staff.map((s) => {
      const rec = s.performanceRecords[0];
      return {
        staffId: s.id,
        name: s.user.name ?? "Staff",
        department: s.user.department ?? s.department,
        jobTitle: s.user.jobTitle,
        ordersCompleted: rec?.ordersCompleted ?? s.ordersCompleted,
        avgStageHours: rec?.avgStageHours ?? s.avgStageHours,
        attendanceScore: rec?.attendanceScore ?? s.attendanceScore,
        punctualityScore: rec?.punctualityScore ?? null,
      };
    }),
  });
}
