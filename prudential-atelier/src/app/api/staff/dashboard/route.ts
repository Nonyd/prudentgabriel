import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { differenceInCalendarDays, startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.staffProfile.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { name: true } } },
  });

  if (!staff) {
    return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
  }

  const today = startOfToday();
  const log = await prisma.attendanceLog.findFirst({
    where: { staffId: staff.id, date: today },
    orderBy: { createdAt: "desc" },
  });

  const isClockedIn = Boolean(log?.clockIn && !log?.clockOut);
  let hoursToday = 0;
  if (log?.clockIn) {
    const end = log.clockOut ?? new Date();
    hoursToday = (end.getTime() - log.clockIn.getTime()) / (1000 * 60 * 60);
  }

  const assignments = await prisma.orderAssignment.findMany({
    where: {
      staffProfileId: staff.id,
      completedAt: null,
    },
    include: {
      order: {
        select: {
          id: true,
          orderRef: true,
          outfitDescription: true,
          clientName: true,
          deliveryDate: true,
          currentStage: true,
        },
      },
    },
    orderBy: { assignedAt: "desc" },
    take: 20,
  });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const tasksCompletedWeek = await prisma.orderAssignment.count({
    where: {
      staffProfileId: staff.id,
      completedAt: { gte: weekStart },
    },
  });

  return NextResponse.json({
    clockStatus: {
      isClockedIn,
      clockIn: log?.clockIn?.toISOString() ?? null,
      taskNote: log?.taskNote ?? null,
      hoursToday: log ? Math.round(hoursToday * 100) / 100 : null,
    },
    assignments: assignments.map((a) => ({
      id: a.id,
      orderId: a.order.id,
      orderRef: a.order.orderRef,
      outfitDescription: a.order.outfitDescription,
      clientFirstName: a.order.clientName.split(/\s+/)[0] ?? a.order.clientName,
      role: a.role,
      deliveryDate: a.order.deliveryDate?.toISOString() ?? null,
      status: a.completedAt ? "Complete" : "In Progress",
      daysUntilDelivery: a.order.deliveryDate
        ? differenceInCalendarDays(a.order.deliveryDate, new Date())
        : null,
    })),
    summary: {
      hoursToday: Math.round(hoursToday * 100) / 100,
      tasksCompletedWeek,
      attendanceScore: staff.attendanceScore,
    },
  });
}
