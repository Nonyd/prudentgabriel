import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";

function isWorkingDay(date: Date): boolean {
  return date.getDay() !== 0;
}

function workingDaysInMonth(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d += 1) {
    const dt = new Date(year, month - 1, d);
    if (isWorkingDay(dt)) count += 1;
  }
  return count;
}

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const now = ctx.now;
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1);
  const resumptionSetting = await prisma.siteSetting.findUnique({
    where: { key: "hr_resumption_time" },
  });
  const resumptionParts = (resumptionSetting?.value ?? "09:00").split(":");
  const resumptionHour = Number(resumptionParts[0] ?? 9);
  const resumptionMinute = Number(resumptionParts[1] ?? 0);

  const staffList = await prisma.staffProfile.findMany({
    where: { isActive: true, employmentType: "EMPLOYEE" },
    include: { user: { select: { name: true } } },
  });

  let processed = 0;
  let failed = 0;
  let stoppedForBudget = false;

  for (const staff of staffList) {
    if (ctx.isBudgetExhausted()) {
      stoppedForBudget = true;
      break;
    }
    try {
      const completedAssignments = await prisma.orderAssignment.findMany({
        where: { staffProfileId: staff.id, completedAt: { not: null } },
        select: { assignedAt: true, completedAt: true },
      });

      const ordersCompleted = completedAssignments.length;
      const stageDurations = completedAssignments
        .filter((a) => a.completedAt)
        .map((a) => (a.completedAt!.getTime() - a.assignedAt.getTime()) / (1000 * 60 * 60));
      const avgStageHours =
        stageDurations.length > 0
          ? stageDurations.reduce((s, h) => s + h, 0) / stageDurations.length
          : null;

      const logs = await prisma.attendanceLog.findMany({
        where: {
          staffId: staff.id,
          date: { gte: monthStart },
          clockIn: { not: null },
        },
      });

      const workingDays = workingDaysInMonth(year, month);
      const daysClockedIn = logs.length;
      const attendanceScore = workingDays > 0 ? (daysClockedIn / workingDays) * 100 : null;

      let onTimeDays = 0;
      for (const log of logs) {
        if (!log.clockIn) continue;
        const ci = log.clockIn;
        const onTime =
          ci.getHours() < resumptionHour ||
          (ci.getHours() === resumptionHour && ci.getMinutes() <= resumptionMinute);
        if (onTime) onTimeDays += 1;
      }
      const punctualityScore = daysClockedIn > 0 ? (onTimeDays / daysClockedIn) * 100 : null;

      await prisma.staffProfile.update({
        where: { id: staff.id },
        data: {
          ordersCompleted,
          avgStageHours,
          attendanceScore,
        },
      });

      await prisma.performanceRecord.upsert({
        where: { staffId_month_year: { staffId: staff.id, month, year } },
        create: {
          staffId: staff.id,
          month,
          year,
          ordersCompleted,
          avgStageHours,
          attendanceScore,
          punctualityScore,
        },
        update: {
          ordersCompleted,
          avgStageHours,
          attendanceScore,
          punctualityScore,
        },
      });

      processed += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    processed,
    failed,
    hasMore: stoppedForBudget,
    detail: { month, year, scanned: staffList.length },
  };
}
