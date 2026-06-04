import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.staffProfile.findUnique({ where: { userId: session.user.id } });
  if (!staff) return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });

  const since = subDays(new Date(), 30);
  since.setHours(0, 0, 0, 0);

  const logs = await prisma.attendanceLog.findMany({
    where: { staffId: staff.id, date: { gte: since } },
    orderBy: { date: "desc" },
    take: 30,
  });

  return NextResponse.json({
    items: logs.map((l) => ({
      date: l.date.toISOString(),
      clockIn: l.clockIn?.toISOString() ?? null,
      clockOut: l.clockOut?.toISOString() ?? null,
      totalHours: l.totalHours,
      taskNote: l.taskNote,
    })),
  });
}
