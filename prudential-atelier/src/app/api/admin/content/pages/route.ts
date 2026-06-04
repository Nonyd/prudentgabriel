import { NextRequest, NextResponse } from "next/server";
import { SettingGroup, SettingType } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const setting = await prisma.siteSetting.findUnique({ where: { key } });
  return NextResponse.json({ key, value: setting?.value ?? "" });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as { key?: string; value?: string } | null;
  if (!body?.key) return NextResponse.json({ error: "key required" }, { status: 400 });

  await prisma.siteSetting.upsert({
    where: { key: body.key },
    create: {
      key: body.key,
      value: body.value ?? "",
      type: SettingType.TEXTAREA,
      group: SettingGroup.CONTENT,
      label: body.key.replace(/^page_/, "").replace(/_/g, " "),
    },
    update: { value: body.value ?? "" },
  });

  return NextResponse.json({ ok: true });
}
