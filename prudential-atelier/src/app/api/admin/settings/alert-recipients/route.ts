import { NextRequest, NextResponse } from "next/server";
import { SettingGroup, SettingType } from "@prisma/client";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { resolveAdminAlertEmail, resolveHrAlertEmail } from "@/lib/admin-alert-email";
import {
  ALERT_KINDS,
  ALERT_RECIPIENTS_KEY,
  CHAT_NOTIFY_BELL_KEY,
  CHAT_NOTIFY_EMAIL_KEY,
  STAFF_ROUTED_ALERTS,
  alertRecipientCandidates,
  readAlertRouting,
  type AlertKind,
} from "@/lib/admin-alerts";
import { logActivity } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { clearSettingCacheKey, getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function view() {
  const [routing, candidates, operational, hr] = await Promise.all([
    readAlertRouting(),
    alertRecipientCandidates(),
    resolveAdminAlertEmail(getSetting),
    resolveHrAlertEmail(getSetting),
  ]);
  return {
    kinds: ALERT_KINDS.map((k) => ({
      id: k.id,
      label: k.label,
      about: k.about,
      hasEmail: k.email,
      hasBell: k.bell.length > 0,
      emailDefault: (k.fallback === "hr" ? hr : operational) ?? null,
      emailDefaultNote: k.id === "contact" ? "the contact inbox set in Page content, else" : null,
      bellDefault: k.bellDefault ?? null,
      email: routing[k.id].email,
      bell: routing[k.id].bell,
    })),
    candidates,
    staffRouted: STAFF_ROUTED_ALERTS,
  };
}

export async function GET() {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;
  return NextResponse.json(await view());
}

const putSchema = z.object({
  kind: z.enum(ALERT_KINDS.map((k) => k.id) as [AlertKind, ...AlertKind[]]),
  channel: z.enum(["email", "bell"]),
  /** Null: back to the default routing. */
  userIds: z.array(z.string().min(10).max(40)).max(50).nullable(),
});

async function put(key: string, value: string, label: string, updatedBy: string) {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value, label, type: SettingType.TEXT, group: SettingGroup.NOTIFICATIONS, isPublic: false, sortOrder: 60, updatedBy },
    update: { value, updatedBy },
  });
  clearSettingCacheKey(key);
}

/**
 * One channel of one kind at a time. A named list must hold at least one
 * active admin; choosing nobody is "use the default", never "tell no one".
 */
export async function PUT(req: NextRequest) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { kind, channel, userIds } = parsed.data;
  const def = ALERT_KINDS.find((k) => k.id === kind)!;
  if (channel === "email" && !def.email) return NextResponse.json({ error: `${def.label} has no email.` }, { status: 400 });
  if (channel === "bell" && def.bell.length === 0) {
    return NextResponse.json({ error: `${def.label} has no bell notification.` }, { status: 400 });
  }

  let ids: string[] | null = null;
  if (userIds) {
    ids = Array.from(new Set(userIds));
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Choose at least one person, or use the default. An alert must never reach nobody." },
        { status: 400 },
      );
    }
    const candidates = new Map((await alertRecipientCandidates()).map((c) => [c.id, c]));
    if (ids.some((id) => !candidates.has(id))) {
      return NextResponse.json({ error: "Recipients must be active admins." }, { status: 400 });
    }
    const unmailable = channel === "email" ? ids.map((id) => candidates.get(id)!).find((c) => !c.mailable) : undefined;
    if (unmailable) {
      return NextResponse.json(
        { error: `${unmailable.name}'s address (${unmailable.email}) does not receive mail. Give them a working email first.` },
        { status: 400 },
      );
    }
  }

  const by = gate.session.user.email ?? gate.session.user.id ?? "super-admin";
  if (kind === "chat") {
    await put(
      channel === "email" ? CHAT_NOTIFY_EMAIL_KEY : CHAT_NOTIFY_BELL_KEY,
      ids ? JSON.stringify(ids) : "",
      channel === "email" ? "Chat: who is emailed (user ids)" : "Chat: who gets the bell (user ids)",
      by,
    );
  } else {
    const raw = await getSetting(ALERT_RECIPIENTS_KEY);
    let map: Record<string, { email?: string[] | null; bell?: string[] | null }> = {};
    try {
      const parsedMap = raw ? (JSON.parse(raw) as unknown) : {};
      if (parsedMap && typeof parsedMap === "object" && !Array.isArray(parsedMap)) map = parsedMap as typeof map;
    } catch {
      map = {};
    }
    map[kind] = { ...(map[kind] ?? {}), [channel]: ids };
    await put(ALERT_RECIPIENTS_KEY, JSON.stringify(map), "Who is told: named recipients per alert (user ids)", by);
  }

  await logActivity({
    action: "UPDATE",
    module: "settings",
    description: `Who is told — ${def.label} by ${channel === "email" ? "email" : "the bell"}: ${
      ids ? `${ids.length} named` : "default"
    }`,
    userEmail: gate.session.user.email ?? undefined,
  }).catch(() => undefined);

  return NextResponse.json(await view());
}
