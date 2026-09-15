import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { SettingType } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { clearSettingCacheKey } from "@/lib/settings";
import { ATELIER_BOOKINGS_SETTING_KEY } from "@/lib/atelier-bookings";
import { ANALYTICS_DAILY_RETENTION_DEFAULT, ANALYTICS_DAILY_RETENTION_KEY } from "@/lib/analytics/paths";

const patchSchema = z.object({
  autoConvertApprovedQuotes: z.boolean().optional(),
  maintenanceModeEnabled: z.boolean().optional(),
  maintenanceModeMessage: z.string().max(500).optional(),
  atelierBookingsEnabled: z.boolean().optional(),
  analyticsDailyRetentionDays: z.number().int().min(30).max(730).optional(),
});

export async function GET() {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;

  const [autoConvertRow, maintenanceEnabledRow, maintenanceMessageRow, atelierRow, retentionRow] = await Promise.all([
    prisma.siteSetting.findUnique({
      where: { key: "auto_convert_approved_quotes" },
      select: { value: true },
    }),
    prisma.siteSetting.findUnique({
      where: { key: "maintenance_mode_enabled" },
      select: { value: true },
    }),
    prisma.siteSetting.findUnique({
      where: { key: "maintenance_mode_message" },
      select: { value: true },
    }),
    prisma.siteSetting.findUnique({
      where: { key: ATELIER_BOOKINGS_SETTING_KEY },
      select: { value: true },
    }),
    prisma.siteSetting.findUnique({
      where: { key: ANALYTICS_DAILY_RETENTION_KEY },
      select: { value: true },
    }),
  ]);

  const retentionDays = Math.max(
    30,
    Math.min(730, Number(retentionRow?.value) || ANALYTICS_DAILY_RETENTION_DEFAULT),
  );

  return NextResponse.json({
    autoConvertApprovedQuotes: autoConvertRow?.value === "true",
    maintenanceModeEnabled: maintenanceEnabledRow?.value === "true",
    maintenanceModeMessage: maintenanceMessageRow?.value ?? "",
    atelierBookingsEnabled: atelierRow?.value === "true",
    analyticsDailyRetentionDays: retentionDays,
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const {
    autoConvertApprovedQuotes,
    maintenanceModeEnabled,
    maintenanceModeMessage,
    atelierBookingsEnabled,
    analyticsDailyRetentionDays,
  } = parsed.data;

  if (
    autoConvertApprovedQuotes === undefined &&
    maintenanceModeEnabled === undefined &&
    maintenanceModeMessage === undefined &&
    atelierBookingsEnabled === undefined &&
    analyticsDailyRetentionDays === undefined
  ) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const userId = gate.session.user!.id!;

  if (autoConvertApprovedQuotes !== undefined) {
    const value = autoConvertApprovedQuotes ? "true" : "false";

    await prisma.siteSetting.upsert({
      where: { key: "auto_convert_approved_quotes" },
      create: {
        key: "auto_convert_approved_quotes",
        value,
        group: "STORE",
        label: "Auto-convert approved quotes to orders",
        type: SettingType.BOOLEAN,
        isPublic: false,
        sortOrder: 100,
        updatedBy: userId,
      },
      update: { value, updatedBy: userId },
    });

    clearSettingCacheKey("auto_convert_approved_quotes");
  }

  if (maintenanceModeEnabled !== undefined) {
    const value = maintenanceModeEnabled ? "true" : "false";

    await prisma.siteSetting.upsert({
      where: { key: "maintenance_mode_enabled" },
      create: {
        key: "maintenance_mode_enabled",
        value,
        group: "STORE",
        label: "Maintenance mode enabled",
        type: SettingType.BOOLEAN,
        isPublic: false,
        sortOrder: 0,
        updatedBy: userId,
      },
      update: { value, updatedBy: userId },
    });

    clearSettingCacheKey("maintenance_mode_enabled");
    revalidatePath("/api/maintenance-status");
    revalidateTag("maintenance");
  }

  if (maintenanceModeMessage !== undefined) {
    await prisma.siteSetting.upsert({
      where: { key: "maintenance_mode_message" },
      create: {
        key: "maintenance_mode_message",
        value: maintenanceModeMessage,
        group: "STORE",
        label: "Maintenance mode message",
        type: SettingType.TEXT,
        isPublic: false,
        sortOrder: 1,
        updatedBy: userId,
      },
      update: { value: maintenanceModeMessage, updatedBy: userId },
    });

    clearSettingCacheKey("maintenance_mode_message");
    revalidatePath("/api/maintenance-status");
  }

  if (atelierBookingsEnabled !== undefined) {
    const value = atelierBookingsEnabled ? "true" : "false";

    await prisma.siteSetting.upsert({
      where: { key: ATELIER_BOOKINGS_SETTING_KEY },
      create: {
        key: ATELIER_BOOKINGS_SETTING_KEY,
        value,
        group: "STORE",
        label: "Atelier bookings enabled",
        type: SettingType.BOOLEAN,
        isPublic: false,
        sortOrder: 2,
        updatedBy: userId,
      },
      update: { value, updatedBy: userId },
    });

    clearSettingCacheKey(ATELIER_BOOKINGS_SETTING_KEY);
  }

  if (analyticsDailyRetentionDays !== undefined) {
    const value = String(analyticsDailyRetentionDays);
    await prisma.siteSetting.upsert({
      where: { key: ANALYTICS_DAILY_RETENTION_KEY },
      create: {
        key: ANALYTICS_DAILY_RETENTION_KEY,
        value,
        group: "STORE",
        label: "Keep daily visit counts (days), then monthly totals",
        type: SettingType.NUMBER,
        isPublic: false,
        sortOrder: 26,
        updatedBy: userId,
      },
      update: { value, updatedBy: userId },
    });
    clearSettingCacheKey(ANALYTICS_DAILY_RETENTION_KEY);
  }

  return NextResponse.json({
    success: true,
    autoConvertApprovedQuotes,
    maintenanceModeEnabled,
    maintenanceModeMessage,
    atelierBookingsEnabled,
    analyticsDailyRetentionDays,
  });
}
