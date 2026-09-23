import { NextRequest, NextResponse } from "next/server";
import { SettingGroup, SettingType } from "@prisma/client";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { clearSettingCacheKey, getSetting } from "@/lib/settings";
import {
  CHAT_ENABLED_KEY,
  CHAT_HOURS_KEY,
  CHAT_RETENTION_DAYS_KEY,
  CHAT_RETENTION_KEEP,
  getChatRetention,
  type ChatRetention,
} from "@/lib/chat";

async function put(key: string, value: string, label: string, type: SettingType, updatedBy: string) {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value, label, type, group: SettingGroup.STORE, isPublic: false, sortOrder: 40, updatedBy },
    update: { value, type, updatedBy },
  });
  clearSettingCacheKey(key);
}

function retentionView(r: ChatRetention) {
  return r.kind === "days" ? { mode: "days" as const, days: r.days } : { mode: r.kind };
}

export async function GET() {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  return NextResponse.json({
    enabled: (await getSetting(CHAT_ENABLED_KEY)) === "true",
    retention: retentionView(await getChatRetention()),
    hoursText: (await getSetting(CHAT_HOURS_KEY)) ?? "",
  });
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  /**
   * The retention decision: "keep" (indefinitely, by decision), a whole number
   * of days, or null to clear it — which also switches chat off.
   */
  retention: z.union([z.literal(CHAT_RETENTION_KEEP), z.number().int().min(1).max(3650), z.null()]).optional(),
  hoursText: z.string().max(400).optional(),
});

/**
 * BA5: chat cannot be switched on until the house has made a retention
 * decision. "Keep indefinitely" is such a decision and is recorded as one; an
 * untouched field is not (409).
 */
export async function PATCH(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const by = gate.session.user.email ?? gate.session.user.id ?? "admin";

  const current = await getChatRetention();
  const nextRaw =
    d.retention === undefined
      ? current.kind === "days"
        ? String(current.days)
        : current.kind === "keep"
          ? CHAT_RETENTION_KEEP
          : ""
      : d.retention === null
        ? ""
        : String(d.retention);
  const decided = nextRaw !== "";
  const enabled = d.enabled !== undefined ? d.enabled : (await getSetting(CHAT_ENABLED_KEY)) === "true";
  if (enabled && !decided) {
    return NextResponse.json(
      { error: "Decide how long conversations are kept (a number of days, or keep indefinitely) before switching chat on." },
      { status: 409 },
    );
  }

  if (d.retention !== undefined) {
    await put(CHAT_RETENTION_DAYS_KEY, nextRaw, "Chat: keep conversations (days, or \"keep\" = indefinitely)", SettingType.TEXT, by);
  }
  if (d.hoursText !== undefined) {
    await put(CHAT_HOURS_KEY, d.hoursText.trim(), "Chat: who answers and when (shown to visitors)", SettingType.TEXT, by);
  }
  // Clearing the decision switches chat off with it.
  await put(CHAT_ENABLED_KEY, enabled && decided ? "true" : "false", "Chat enabled", SettingType.BOOLEAN, by);

  return NextResponse.json({
    enabled: enabled && decided,
    retention: retentionView(await getChatRetention()),
    hoursText: (await getSetting(CHAT_HOURS_KEY)) ?? "",
  });
}
