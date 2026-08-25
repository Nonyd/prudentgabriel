import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ATELIER_STOREFRONT_SETTING_KEY } from "@/lib/atelier-storefront";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [enabledSetting, messageSetting, atelierSetting] = await Promise.all([
      prisma.siteSetting.findUnique({
        where: { key: "maintenance_mode_enabled" },
      }),
      prisma.siteSetting.findUnique({
        where: { key: "maintenance_mode_message" },
      }),
      prisma.siteSetting.findUnique({
        where: { key: ATELIER_STOREFRONT_SETTING_KEY },
      }),
    ]);

    return NextResponse.json(
      {
        enabled: enabledSetting?.value === "true",
        atelierStorefrontEnabled: atelierSetting?.value === "true",
        message:
          messageSetting?.value || "We're making some improvements. Check back soon.",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        },
      },
    );
  } catch {
    return NextResponse.json({ enabled: false, message: "" });
  }
}
