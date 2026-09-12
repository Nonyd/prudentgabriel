import { NextRequest, NextResponse } from "next/server";
import { SettingGroup, SettingType } from "@prisma/client";
import { requireAdminApi, CMS_ADMIN_PERMISSIONS } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { clearContentSettingsCache, clearPublicSettingsCache, clearSettingCacheKey } from "@/lib/settings";
import { getPageById, getPageFieldKeys } from "@/lib/cms-config";
import { revalidateStorefront } from "@/lib/revalidate";
import {
  findUnknownLegalTokens,
  isLegalContentSettingKey,
  LEGAL_SIGNIFICANT_SETTING_KEYS,
} from "@/lib/legal-token-syntax";
import { logLegallySignificantChange } from "@/lib/legal-tokens";

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
    const unknown = new Set<string>();
    for (const [key, value] of entries) {
      if (isLegalContentSettingKey(key)) {
        for (const token of findUnknownLegalTokens(value ?? "")) unknown.add(token);
      }
    }
    if (unknown.size > 0) {
      return NextResponse.json(
        {
          error: `Unknown legal tokens: ${Array.from(unknown).join(", ")}. Public pages will not show braces; fix the names before saving.`,
          unknown: Array.from(unknown),
        },
        { status: 400 },
      );
    }
    const updatedBy = gate.session.user.id;

    const previous = await prisma.siteSetting.findMany({
      where: { key: { in: entries.map(([key]) => key) } },
      select: { key: true, value: true },
    });
    const previousByKey = Object.fromEntries(previous.map((row) => [row.key, row.value]));

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

    for (const [key, value] of entries) {
      if (!LEGAL_SIGNIFICANT_SETTING_KEYS.has(key)) continue;
      const prev = previousByKey[key] ?? "";
      if (prev === (value ?? "")) continue;
      await logLegallySignificantChange({
        userId: updatedBy,
        userEmail: gate.session.user.email ?? undefined,
        userRole: gate.session.user.role ?? undefined,
        key,
        previous: prev,
        next: value ?? "",
      });
    }

    for (const [key] of entries) clearSettingCacheKey(key);
    clearPublicSettingsCache();
    clearContentSettingsCache();
    await revalidateStorefront();

    return NextResponse.json({ ok: true, saved: entries.length });
  }

  if (!body?.key) return NextResponse.json({ error: "key required" }, { status: 400 });

  if (isLegalContentSettingKey(body.key)) {
    const unknown = findUnknownLegalTokens(body.value ?? "");
    if (unknown.length > 0) {
      return NextResponse.json(
        {
          error: `Unknown legal tokens: ${unknown.join(", ")}. Public pages will not show braces; fix the names before saving.`,
          unknown,
        },
        { status: 400 },
      );
    }
  }

  const previousRow = LEGAL_SIGNIFICANT_SETTING_KEYS.has(body.key)
    ? await prisma.siteSetting.findUnique({ where: { key: body.key }, select: { value: true } })
    : null;

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

  if (
    LEGAL_SIGNIFICANT_SETTING_KEYS.has(body.key) &&
    (previousRow?.value ?? "") !== (body.value ?? "")
  ) {
    await logLegallySignificantChange({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      key: body.key,
      previous: previousRow?.value ?? "",
      next: body.value ?? "",
    });
  }

  clearSettingCacheKey(body.key);
  clearPublicSettingsCache();
  clearContentSettingsCache();
  await revalidateStorefront();

  return NextResponse.json({ ok: true });
}
