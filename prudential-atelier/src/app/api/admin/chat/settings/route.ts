import { NextRequest, NextResponse } from "next/server";
import { SettingGroup, SettingType } from "@prisma/client";
import { z } from "zod";
import { isGeneralAdminRole, requireAdminApi, requireGeneralAdminApi, resolveSessionAccess } from "@/lib/admin-auth";
import { getAdminImpersonation } from "@/lib/admin-impersonate";
import { prisma } from "@/lib/prisma";
import { clearSettingCacheKey, getSetting } from "@/lib/settings";
import {
  CHAT_CLAIM_IDLE_MIN_KEY,
  CHAT_CLOSED_DATES_KEY,
  CHAT_EDIT_WINDOW_KEY,
  CHAT_ENABLED_KEY,
  CHAT_GIVEUP_MIN_KEY,
  CHAT_GREETING_DELAY_KEY,
  CHAT_HOURS_KEY,
  CHAT_RENOTIFY_MIN_KEY,
  CHAT_RETENTION_DAYS_KEY,
  CHAT_RETENTION_KEEP,
  CHAT_SCHEDULE_KEY,
  getChatAvailability,
  getChatRetention,
  getChatStaffing,
  type ChatRetention,
} from "@/lib/chat";
import { isRealDate, scheduleError } from "@/lib/chat-hours";

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

async function view(isSuperAdmin: boolean, canEdit = true) {
  const s = await getChatStaffing();
  const a = await getChatAvailability(new Date(), s);
  return {
    enabled: (await getSetting(CHAT_ENABLED_KEY)) === "true",
    retention: retentionView(await getChatRetention()),
    hoursText: (await getSetting(CHAT_HOURS_KEY)) ?? "",
    // BF2: null schedule = closed (fails closed); the admin shows that plainly.
    schedule: s.schedule,
    closedDates: s.closedDates,
    live: a.live,
    opensLabel: a.opensLabel,
    greetingDelaySec: s.greetingDelaySec,
    editWindowSec: s.editWindowSec,
    renotifyMin: s.renotifyMin,
    giveUpMin: s.giveUpMin,
    claimIdleMin: s.claimIdleMin,
    canChooseRecipients: isSuperAdmin,
    canEdit,
  };
}

/** Real SUPER_ADMIN (not viewing as someone): only she names who is told (BF9). */
async function realSuperAdmin(session: { user: { role?: string | null; email?: string | null } }) {
  if (session.user.role !== "SUPER_ADMIN") return false;
  return !(await getAdminImpersonation(session.user.role, session.user.email));
}

/** Anyone with Live chat reads the state (the inbox needs the edit window); only Admins change it. */
export async function GET() {
  const gate = await requireAdminApi("chat");
  if (!gate.ok) return gate.response;
  const { role } = await resolveSessionAccess(gate.session);
  return NextResponse.json(await view(await realSuperAdmin(gate.session), isGeneralAdminRole(role)));
}

const dayHours = z.union([z.null(), z.object({ open: z.string(), close: z.string() })]);

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  /**
   * The retention decision: "keep" (indefinitely, by decision), a whole number
   * of days, or null to clear it — which also switches chat off.
   */
  retention: z.union([z.literal(CHAT_RETENTION_KEEP), z.number().int().min(1).max(3650), z.null()]).optional(),
  hoursText: z.string().max(400).optional(),
  /** BF2: the weekly schedule (Lagos time), or null to clear it (= closed). */
  schedule: z
    .union([
      z.null(),
      z.object({ sun: dayHours, mon: dayHours, tue: dayHours, wed: dayHours, thu: dayHours, fri: dayHours, sat: dayHours }),
    ])
    .optional(),
  closedDates: z.array(z.string()).max(400).optional(),
  /** BF3: seconds, or null to switch the greeting off. */
  greetingDelaySec: z.union([z.number().int().min(0).max(600), z.null()]).optional(),
  editWindowSec: z.number().int().min(0).max(600).optional(),
  renotifyMin: z.number().int().min(1).max(240).optional(),
  giveUpMin: z.number().int().min(2).max(480).optional(),
  claimIdleMin: z.number().int().min(1).max(240).optional(),
});

/**
 * BA5: chat cannot be switched on until the house has made a retention
 * decision. "Keep indefinitely" is such a decision and is recorded as one; an
 * untouched field is not (409).
 *
 * Who is told about a chat is not set here: Settings → Who is told.
 */
export async function PATCH(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const by = gate.session.user.email ?? gate.session.user.id ?? "admin";
  const superAdmin = await realSuperAdmin(gate.session);

  // ── Validate everything before writing anything ──
  if (d.schedule) {
    const err = scheduleError(d.schedule);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }
  const badDate = d.closedDates?.find((x) => !isRealDate(x));
  if (badDate) return NextResponse.json({ error: `Not a date: ${badDate} (use YYYY-MM-DD)` }, { status: 400 });
  const current = await getChatStaffing();
  if ((d.renotifyMin ?? current.renotifyMin) >= (d.giveUpMin ?? current.giveUpMin)) {
    return NextResponse.json(
      { error: "Telling her nobody is free must come after telling the recipients again." },
      { status: 400 },
    );
  }
  const currentRetention = await getChatRetention();
  const nextRaw =
    d.retention === undefined
      ? currentRetention.kind === "days"
        ? String(currentRetention.days)
        : currentRetention.kind === "keep"
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
  if (d.schedule !== undefined) {
    await put(CHAT_SCHEDULE_KEY, d.schedule ? JSON.stringify(d.schedule) : "", "Chat: weekly hours (Lagos time)", SettingType.TEXT, by);
  }
  if (d.closedDates !== undefined) {
    const dates = Array.from(new Set(d.closedDates)).sort();
    await put(CHAT_CLOSED_DATES_KEY, JSON.stringify(dates), "Chat: dates the house is closed", SettingType.TEXT, by);
  }
  if (d.greetingDelaySec !== undefined) {
    await put(CHAT_GREETING_DELAY_KEY, d.greetingDelaySec === null ? "off" : String(d.greetingDelaySec), "Chat: greeting delay (seconds, or off)", SettingType.TEXT, by);
  }
  if (d.editWindowSec !== undefined) {
    await put(CHAT_EDIT_WINDOW_KEY, String(d.editWindowSec), "Chat: seconds a message may be edited", SettingType.NUMBER, by);
  }
  if (d.renotifyMin !== undefined) {
    await put(CHAT_RENOTIFY_MIN_KEY, String(d.renotifyMin), "Chat: minutes unanswered before recipients are told again", SettingType.NUMBER, by);
  }
  if (d.giveUpMin !== undefined) {
    await put(CHAT_GIVEUP_MIN_KEY, String(d.giveUpMin), "Chat: minutes unanswered before she is told nobody is free", SettingType.NUMBER, by);
  }
  if (d.claimIdleMin !== undefined) {
    await put(CHAT_CLAIM_IDLE_MIN_KEY, String(d.claimIdleMin), "Chat: minutes idle before a claimed chat returns to the pool", SettingType.NUMBER, by);
  }
  // Clearing the decision switches chat off with it.
  await put(CHAT_ENABLED_KEY, enabled && decided ? "true" : "false", "Chat enabled", SettingType.BOOLEAN, by);

  return NextResponse.json(await view(superAdmin));
}
