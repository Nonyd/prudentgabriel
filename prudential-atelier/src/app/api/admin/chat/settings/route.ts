import { NextRequest, NextResponse } from "next/server";
import { SettingGroup, SettingType } from "@prisma/client";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { clearSettingCacheKey, getSetting } from "@/lib/settings";
import { CHAT_ENABLED_KEY, CHAT_HOURS_KEY, CHAT_RETENTION_DAYS_KEY, getChatRetentionDays } from "@/lib/chat";

async function put(key: string, value: string, label: string, type: SettingType, updatedBy: string) {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value, label, type, group: SettingGroup.STORE, isPublic: false, sortOrder: 40, updatedBy },
    update: { value, updatedBy },
  });
  clearSettingCacheKey(key);
}

export async function GET() {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  return NextResponse.json({
    enabled: (await getSetting(CHAT_ENABLED_KEY)) === "true",
    retentionDays: await getChatRetentionDays(),
    hoursText: (await getSetting(CHAT_HOURS_KEY)) ?? "",
  });
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  /** Whole days. Null clears it — which also switches chat off. */
  retentionDays: z.number().int().min(1).max(3650).nullable().optional(),
  hoursText: z.string().max(400).optional(),
});

/**
 * BA5: chat cannot be switched on until a retention period is set. It must not
 * default to "forever", and nobody should invent the number: Mrs. Prudent sets it.
 */
export async function PATCH(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const by = gate.session.user.email ?? gate.session.user.id ?? "admin";

  const retention = d.retentionDays !== undefined ? d.retentionDays : await getChatRetentionDays();
  const enabled = d.enabled !== undefined ? d.enabled : (await getSetting(CHAT_ENABLED_KEY)) === "true";
  if (enabled && retention == null) {
    return NextResponse.json(
      { error: "Set how long conversations are kept before switching chat on." },
      { status: 409 },
    );
  }

  if (d.retentionDays !== undefined) {
    await put(CHAT_RETENTION_DAYS_KEY, d.retentionDays == null ? "" : String(d.retentionDays), "Chat: keep conversations for (days)", SettingType.NUMBER, by);
  }
  if (d.hoursText !== undefined) {
    await put(CHAT_HOURS_KEY, d.hoursText.trim(), "Chat: who answers and when (shown to visitors)", SettingType.TEXT, by);
  }
  // Clearing retention switches chat off with it.
  await put(CHAT_ENABLED_KEY, enabled && retention != null ? "true" : "false", "Chat enabled", SettingType.BOOLEAN, by);

  return NextResponse.json({ enabled: enabled && retention != null, retentionDays: retention, hoursText: (await getSetting(CHAT_HOURS_KEY)) ?? "" });
}
