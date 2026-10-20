import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { isUndeliverableAlertAddress } from "@/lib/admin-alert-email";
import {
  ALERT_KINDS,
  ALERT_RECIPIENTS_KEY,
  CHAT_NOTIFY_BELL_KEY,
  CHAT_NOTIFY_EMAIL_KEY,
  STAFF_ROUTED_ALERTS,
  alertRecipientCandidates,
  cleanAddressList,
  eligibleFor,
  readAlertRouting,
  readStoredMap,
  writeSetting,
  type AlertKind,
} from "@/lib/admin-alerts";
import { logActivity } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function view() {
  const [routing, candidates] = await Promise.all([readAlertRouting(), alertRecipientCandidates()]);
  return {
    kinds: ALERT_KINDS.map((k) => ({
      id: k.id,
      label: k.label,
      about: k.about,
      hasEmail: k.email,
      hasBell: k.bell.length > 0,
      bellDefault: k.bellDefault ?? null,
      email: routing[k.id].email,
      addresses: routing[k.id].addresses,
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
  /** Email: empty or null means nobody is emailed. Bell: null means everyone who handles it. */
  userIds: z.array(z.string().min(10).max(40)).max(50).nullable(),
  /** Email only: addresses that are not a portal user. */
  addresses: z.array(z.string().trim().toLowerCase().email().max(254)).max(20).optional(),
});

/**
 * One channel of one kind at a time. This page is the only place an alert
 * email's recipients are set: what is saved here is exactly who is emailed.
 */
export async function PUT(req: NextRequest) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const bad = parsed.error.issues.some((i) => i.path[0] === "addresses");
    return NextResponse.json({ error: bad ? "One of the email addresses is not valid." : "Invalid request" }, { status: 400 });
  }
  const { kind, channel, userIds } = parsed.data;
  const def = ALERT_KINDS.find((k) => k.id === kind)!;
  if (channel === "email" && !def.email) return NextResponse.json({ error: `${def.label} has no email.` }, { status: 400 });
  if (channel === "bell" && def.bell.length === 0) {
    return NextResponse.json({ error: `${def.label} has no bell notification.` }, { status: 400 });
  }

  const unique = userIds ? Array.from(new Set(userIds)) : [];
  const ids: string[] | null = unique.length ? unique : null;
  if (ids) {
    const candidates = new Map((await alertRecipientCandidates()).map((c) => [c.id, c]));
    if (ids.some((id) => !candidates.has(id) || !eligibleFor(kind, candidates.get(id)!))) {
      return NextResponse.json(
        {
          error:
            kind === "chat"
              ? "Chat recipients must be active people with Live chat."
              : "Recipients must be active admins.",
        },
        { status: 400 },
      );
    }
    const unmailable = channel === "email" ? ids.map((id) => candidates.get(id)!).find((c) => !c.mailable) : undefined;
    if (unmailable) {
      return NextResponse.json(
        { error: `${unmailable.name}'s address (${unmailable.email}) does not receive mail. Give them a working email first.` },
        { status: 400 },
      );
    }
  }

  let addresses: string[] | null = null;
  if (channel === "email") {
    const dead = parsed.data.addresses?.find((a) => isUndeliverableAlertAddress(a));
    if (dead) return NextResponse.json({ error: `${dead} does not receive mail.` }, { status: 400 });
    addresses = cleanAddressList(parsed.data.addresses ?? []);
  }

  const by = gate.session.user.email ?? gate.session.user.id ?? "super-admin";
  const map = await readStoredMap();
  if (kind === "chat") {
    await writeSetting(
      channel === "email" ? CHAT_NOTIFY_EMAIL_KEY : CHAT_NOTIFY_BELL_KEY,
      ids ? JSON.stringify(ids) : "",
      channel === "email" ? "Chat: who is emailed (user ids)" : "Chat: who gets the bell (user ids)",
      by,
    );
    if (channel === "email") map.chat = { ...(map.chat ?? {}), addresses };
  } else {
    map[kind] = { ...(map[kind] ?? {}), [channel]: ids, ...(channel === "email" ? { addresses } : {}) };
  }
  if (kind !== "chat" || channel === "email") {
    await writeSetting(ALERT_RECIPIENTS_KEY, JSON.stringify(map), "Who is told: named recipients per alert", by);
  }

  const count = (ids?.length ?? 0) + (addresses?.length ?? 0);
  await logActivity({
    action: "UPDATE",
    module: "settings",
    description: `Who is told — ${def.label} by ${channel === "email" ? "email" : "the bell"}: ${
      channel === "email" ? (count ? `${count} named` : "nobody") : ids ? `${ids.length} named` : "default"
    }`,
    userEmail: gate.session.user.email ?? undefined,
  }).catch(() => undefined);

  return NextResponse.json(await view());
}
