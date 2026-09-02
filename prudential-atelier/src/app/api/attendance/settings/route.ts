import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SettingGroup } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireAdminApi("attendance");
  if (!gate.ok) return gate.response;

  const setting = await prisma.siteSetting.findUnique({
    where: { key: "hr_resumption_time" },
  });

  return NextResponse.json({
    resumptionTime: setting?.value ?? "09:00",
  });
}

const patchSchema = z.object({
  resumptionTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminApi("attendance");
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.siteSetting.upsert({
    where: { key: "hr_resumption_time" },
    create: {
      key: "hr_resumption_time",
      value: parsed.data.resumptionTime,
      label: "HR resumption time",
      type: "TEXT",
      group: SettingGroup.NOTIFICATIONS,
    },
    update: { value: parsed.data.resumptionTime },
  });

  return NextResponse.json({ resumptionTime: parsed.data.resumptionTime });
}
