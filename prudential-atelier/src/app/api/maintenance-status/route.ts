import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 30;

export async function GET() {
  try {
    const [enabledSetting, messageSetting] = await Promise.all([
      prisma.siteSetting.findUnique({
        where: { key: "maintenance_mode_enabled" },
      }),
      prisma.siteSetting.findUnique({
        where: { key: "maintenance_mode_message" },
      }),
    ]);

    return NextResponse.json(
      {
        enabled: enabledSetting?.value === "true",
        message:
          messageSetting?.value || "We're making some improvements. Check back soon.",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  } catch {
    return NextResponse.json({ enabled: false, message: "" });
  }
}
