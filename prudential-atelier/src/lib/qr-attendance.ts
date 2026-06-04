import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";

const QR_VALIDITY_HOURS = 24;

export async function generateDailyQR(): Promise<string> {
  const code = `PA-QR-${nanoid(12)}`;
  const expiresAt = new Date(Date.now() + QR_VALIDITY_HOURS * 60 * 60 * 1000);

  await prisma.qRCode.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  await prisma.qRCode.create({
    data: { code, expiresAt, isActive: true },
  });

  return code;
}

export async function getActiveQRCode(): Promise<{ code: string; expiresAt: Date } | null> {
  const active = await prisma.qRCode.findFirst({
    where: {
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!active) return null;
  return { code: active.code, expiresAt: active.expiresAt };
}

export async function rotateDailyQR(): Promise<string> {
  return generateDailyQR();
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function processQRScan(
  qrCode: string,
  userId: string,
  taskNote: string,
): Promise<{ success: boolean; message: string; alreadyClockedIn: boolean }> {
  let code = qrCode.trim();
  if (code.startsWith("{")) {
    try {
      const parsed = JSON.parse(code) as { code?: string };
      if (parsed.code) code = parsed.code;
    } catch {
      /* use raw input */
    }
  }

  const record = await prisma.qRCode.findFirst({
    where: { code, isActive: true, expiresAt: { gt: new Date() } },
  });

  if (!record) {
    return { success: false, message: "Invalid or expired QR code.", alreadyClockedIn: false };
  }

  const staff = await prisma.staffProfile.findUnique({ where: { userId } });
  if (!staff) {
    return { success: false, message: "Staff profile not found.", alreadyClockedIn: false };
  }

  if (staff.employmentType === "FREELANCER") {
    return {
      success: false,
      message: "Freelancers are not required to clock in.",
      alreadyClockedIn: false,
    };
  }

  const today = startOfToday();
  const existing = await prisma.attendanceLog.findFirst({
    where: {
      staffId: staff.id,
      date: today,
      clockIn: { not: null },
      clockOut: null,
    },
  });

  if (existing) {
    return {
      success: true,
      message: "You are already clocked in for today.",
      alreadyClockedIn: true,
    };
  }

  const openLog = await prisma.attendanceLog.findFirst({
    where: { staffId: staff.id, date: today },
  });

  if (openLog?.clockIn) {
    return {
      success: true,
      message: "You are already clocked in for today.",
      alreadyClockedIn: true,
    };
  }

  if (openLog) {
    await prisma.attendanceLog.update({
      where: { id: openLog.id },
      data: { clockIn: new Date(), taskNote: taskNote.trim() || null },
    });
  } else {
    await prisma.attendanceLog.create({
      data: {
        staffId: staff.id,
        date: today,
        clockIn: new Date(),
        taskNote: taskNote.trim() || null,
      },
    });
  }

  return { success: true, message: "Clocked in successfully.", alreadyClockedIn: false };
}

export async function clockOutStaff(userId: string): Promise<{ success: boolean; message: string }> {
  const staff = await prisma.staffProfile.findUnique({ where: { userId } });
  if (!staff) {
    return { success: false, message: "Staff profile not found." };
  }

  const today = startOfToday();
  const log = await prisma.attendanceLog.findFirst({
    where: {
      staffId: staff.id,
      date: today,
      clockIn: { not: null },
      clockOut: null,
    },
  });

  if (!log) {
    return { success: false, message: "No active clock-in found for today." };
  }

  const clockOut = new Date();
  const totalHours =
    log.clockIn != null
      ? Math.round(((clockOut.getTime() - log.clockIn.getTime()) / (1000 * 60 * 60)) * 100) / 100
      : null;

  await prisma.attendanceLog.update({
    where: { id: log.id },
    data: { clockOut, totalHours },
  });

  return { success: true, message: "Clocked out successfully." };
}

export async function getStaffClockStatus(userId: string) {
  const staff = await prisma.staffProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!staff) return null;

  const today = startOfToday();
  const log = await prisma.attendanceLog.findFirst({
    where: { staffId: staff.id, date: today },
    orderBy: { createdAt: "desc" },
  });

  return {
    staff,
    log,
    isClockedIn: Boolean(log?.clockIn && !log?.clockOut),
  };
}
