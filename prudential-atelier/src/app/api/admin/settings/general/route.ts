import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SettingType } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { clearSettingCacheKey } from "@/lib/settings";

const patchSchema = z.object({
  autoConvertApprovedQuotes: z.boolean().optional(),
});

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const row = await prisma.siteSetting.findUnique({
    where: { key: "auto_convert_approved_quotes" },
    select: { value: true },
  });

  return NextResponse.json({
    autoConvertApprovedQuotes: row?.value === "true",
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.autoConvertApprovedQuotes === undefined) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const userId = gate.session.user!.id!;
  const value = parsed.data.autoConvertApprovedQuotes ? "true" : "false";

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

  return NextResponse.json({ success: true, autoConvertApprovedQuotes: parsed.data.autoConvertApprovedQuotes });
}
