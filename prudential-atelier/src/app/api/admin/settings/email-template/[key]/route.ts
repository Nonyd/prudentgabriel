import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { clearPublicSettingsCache, clearSettingCacheKey } from "@/lib/settings";
import { EMAIL_TEMPLATE_META } from "@/lib/email-templates";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { key: string } },
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const key = params.key;
  if (!key.startsWith("email_tpl_") || !EMAIL_TEMPLATE_META[key]) {
    return NextResponse.json({ error: "Invalid template key" }, { status: 400 });
  }

  const existing = await prisma.siteSetting.findUnique({
    where: { key },
    select: { id: true, group: true },
  });
  if (!existing || existing.group !== "EMAIL") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.siteSetting.delete({ where: { key } });
  clearSettingCacheKey(key);
  clearPublicSettingsCache();

  return NextResponse.json({ success: true });
}
