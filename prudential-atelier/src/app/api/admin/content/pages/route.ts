import { NextRequest, NextResponse } from "next/server";
import { SettingGroup, SettingType } from "@prisma/client";
import { requireAdminApi, CMS_ADMIN_PERMISSIONS } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { clearContentSettingsCache, clearPublicSettingsCache, clearSettingCacheKey } from "@/lib/settings";
import { getPageById, getPageFieldKeys } from "@/lib/cms-config";
import { revalidateStorefront } from "@/lib/revalidate";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi(CMS_ADMIN_PERMISSIONS);
  if (!gate.ok) return gate.response;

  const pageId = req.nextUrl.searchParams.get("pageId");
  const key = req.nextUrl.searchParams.get("key");

  if (pageId) {
    const page = getPageById(pageId);
    if (!page) return NextResponse.json({ error: "Unknown page" }, { status: 404 });

    const keys = getPageFieldKeys(pageId);
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true, updatedAt: true },
    });

    const values: Record<string, string> = {};
    let lastEdited: string | null = null;
    for (const s of settings) {
      values[s.key] = s.value;
      const iso = s.updatedAt.toISOString();
      if (!lastEdited || iso > lastEdited) lastEdited = iso;
    }

    return NextResponse.json({ pageId, values, lastEdited });
  }

  if (key) {
    const setting = await prisma.siteSetting.findUnique({ where: { key } });
    return NextResponse.json({ key, value: setting?.value ?? "" });
  }

  return NextResponse.json({ error: "pageId or key required" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdminApi(CMS_ADMIN_PERMISSIONS);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as
    | { key?: string; value?: string; pageId?: string; values?: Record<string, string> }
    | null;

  if (body?.pageId && body.values) {
    const page = getPageById(body.pageId);
    if (!page) return NextResponse.json({ error: "Unknown page" }, { status: 404 });

    const allowed = new Set(getPageFieldKeys(body.pageId));
    const entries = Object.entries(body.values).filter(([k]) => allowed.has(k));
    const updatedBy = gate.session.user.id;

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.siteSetting.upsert({
          where: { key },
          create: {
            key,
            value: value ?? "",
            type: key.startsWith("legal_") ? SettingType.TEXTAREA : SettingType.TEXT,
            group: SettingGroup.CONTENT,
            label: key.replace(/_/g, " "),
            isPublic: true,
          },
          update: { value: value ?? "", updatedBy },
        }),
      ),
    );

    for (const [key] of entries) clearSettingCacheKey(key);
    clearPublicSettingsCache();
    clearContentSettingsCache();
    await revalidateStorefront();

    return NextResponse.json({ ok: true, saved: entries.length });
  }

  if (!body?.key) return NextResponse.json({ error: "key required" }, { status: 400 });

  await prisma.siteSetting.upsert({
    where: { key: body.key },
    create: {
      key: body.key,
      value: body.value ?? "",
      type: body.key.startsWith("legal_") ? SettingType.TEXTAREA : SettingType.TEXTAREA,
      group: SettingGroup.CONTENT,
      label: body.key.replace(/^page_/, "").replace(/_/g, " "),
      isPublic: true,
    },
    update: { value: body.value ?? "", updatedBy: gate.session.user.id },
  });

  clearSettingCacheKey(body.key);
  clearPublicSettingsCache();
  clearContentSettingsCache();
  await revalidateStorefront();

  return NextResponse.json({ ok: true });
}
