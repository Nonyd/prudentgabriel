import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { commissionTitle } from "@/lib/atelier/commission-list";

/**
 * Slice BD7 — end of day.
 *
 * "Staff dashboards will feature a mandatory end-of-day reporting tool where
 * personnel can log daily work activities on assigned dresses." One entry per
 * assigned commission per Lagos day: what was done, how far it got, anything in
 * the way, pictures where they help.
 *
 * Mandatory means the portal asks for it from the set hour and the daily report
 * names who has not filed. Nobody is locked out: a tailor at 6pm still reaches
 * everything else. Saying her part is done writes OrderAssignment.completedAt.
 */

export const WORK_LOG_TZ = "Africa/Lagos";
export const DEFAULT_PROMPT_HOUR = 16;
const MAX_IMAGES = 6;

const CLOSED: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.ARCHIVED, OrderStatus.CANCELLED];

function lagosParts(at: Date): { y: number; m: number; d: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WORK_LOG_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), hour: get("hour") };
}

/** The Lagos calendar day of `at`, as a UTC-midnight Date (how @db.Date stores it). */
export function lagosDay(at: Date = new Date()): Date {
  const { y, m, d } = lagosParts(at);
  return new Date(Date.UTC(y, m - 1, d));
}

export function lagosHour(at: Date = new Date()): number {
  return lagosParts(at).hour;
}

export async function promptHour(): Promise<number> {
  const raw = Number(await getSetting("workroom_eod_prompt_hour"));
  return Number.isInteger(raw) && raw >= 0 && raw <= 23 ? raw : DEFAULT_PROMPT_HOUR;
}

/** Pure: from this hour, the portal asks for any entry not yet filed. */
export function promptDue(now: Date, hour: number): boolean {
  return lagosHour(now) >= hour;
}

export type WorkLogInput = {
  assignmentId: string;
  done: string;
  progress: number;
  blocker: string | null;
  images: string[];
  partDone: boolean;
};

export function parseWorkLogInput(raw: unknown): { ok: true; input: WorkLogInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Send the day's entry." };
  const r = raw as Record<string, unknown>;
  const assignmentId = typeof r.assignmentId === "string" ? r.assignmentId : "";
  if (!assignmentId) return { ok: false, error: "Which commission is this for?" };
  const done = typeof r.done === "string" ? r.done.trim().slice(0, 2000) : "";
  if (!done) return { ok: false, error: "Say what was done today." };
  const progress = Math.round(Number(r.progress));
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    return { ok: false, error: "How far it got is 0 to 100." };
  }
  const blocker = typeof r.blocker === "string" && r.blocker.trim() ? r.blocker.trim().slice(0, 1000) : null;
  const images = Array.isArray(r.images)
    ? r.images.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, MAX_IMAGES)
    : [];
  return { ok: true, input: { assignmentId, done, progress, blocker, images, partDone: r.partDone === true } };
}

export type WorkdayItem = {
  assignmentId: string;
  orderId: string;
  orderRef: string;
  title: string;
  role: string;
  completedAt: string | null;
  entry: { done: string; progress: number; blocker: string | null; images: string[]; partDone: boolean; updatedAt: string } | null;
};

/** One person's open assignments and today's entries. */
export async function workday(staffProfileId: string, now = new Date()) {
  const day = lagosDay(now);
  const assignments = await prisma.orderAssignment.findMany({
    where: {
      staffProfileId,
      order: { status: { notIn: CLOSED } },
      // Done earlier stays done; done today still shows so she can see it filed.
      OR: [{ completedAt: null }, { workLogs: { some: { day } } }],
    },
    orderBy: { assignedAt: "asc" },
    select: {
      id: true,
      role: true,
      completedAt: true,
      order: {
        select: {
          id: true,
          orderRef: true,
          clientName: true,
          title: true,
          occasionType: true,
          occasionDetails: true,
          deliveryDate: true,
        },
      },
      workLogs: { where: { day }, take: 1 },
    },
  });
  const items: WorkdayItem[] = assignments.map((a) => {
    const e = a.workLogs[0];
    return {
      assignmentId: a.id,
      orderId: a.order.id,
      orderRef: a.order.orderRef,
      title: commissionTitle(a.order).text,
      role: a.role,
      completedAt: a.completedAt?.toISOString() ?? null,
      entry: e
        ? { done: e.done, progress: e.progress, blocker: e.blocker, images: e.images, partDone: e.partDone, updatedAt: e.updatedAt.toISOString() }
        : null,
    };
  });
  const hour = await promptHour();
  return {
    day: day.toISOString().slice(0, 10),
    promptHour: hour,
    promptDue: promptDue(now, hour),
    missing: items.filter((i) => !i.entry && !i.completedAt).length,
    items,
  };
}

/**
 * File (or refile) today's entry for one of her assignments. Same day, same
 * row: she can correct it until the day ends. "Her part is done" writes the
 * assignment's completedAt once and does not unset it.
 */
export async function fileWorkLog(
  staffProfileId: string,
  input: WorkLogInput,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; status: 403 | 404 | 409; error: string }> {
  const a = await prisma.orderAssignment.findUnique({
    where: { id: input.assignmentId },
    select: { staffProfileId: true, orderId: true, completedAt: true, order: { select: { status: true } } },
  });
  if (!a) return { ok: false, status: 404, error: "Not found" };
  if (a.staffProfileId !== staffProfileId) return { ok: false, status: 403, error: "That is not your assignment." };
  if (CLOSED.includes(a.order.status)) return { ok: false, status: 409, error: "That commission is closed." };

  const day = lagosDay(now);
  const data = {
    done: input.done,
    progress: input.partDone ? 100 : input.progress,
    blocker: input.blocker,
    images: input.images,
    partDone: input.partDone,
  };
  await prisma.$transaction([
    prisma.workLog.upsert({
      where: { assignmentId_day: { assignmentId: input.assignmentId, day } },
      create: { ...data, assignmentId: input.assignmentId, orderId: a.orderId, staffProfileId, day },
      update: data,
    }),
    ...(input.partDone && !a.completedAt
      ? [prisma.orderAssignment.update({ where: { id: input.assignmentId }, data: { completedAt: now } })]
      : []),
  ]);
  return { ok: true };
}

/** For the daily report: today's entries, and who with open work has not filed. */
export async function workroomDay(now = new Date()) {
  const day = lagosDay(now);
  const [entries, open] = await Promise.all([
    prisma.workLog.findMany({
      where: { day },
      orderBy: [{ order: { orderRef: "asc" } }, { createdAt: "asc" }],
      select: {
        done: true,
        progress: true,
        blocker: true,
        partDone: true,
        order: { select: { orderRef: true } },
        assignment: { select: { role: true } },
        staffProfile: { select: { user: { select: { name: true, email: true } } } },
      },
    }),
    prisma.orderAssignment.findMany({
      where: { completedAt: null, order: { status: { notIn: CLOSED } }, workLogs: { none: { day } } },
      select: {
        role: true,
        order: { select: { orderRef: true } },
        staffProfile: { select: { user: { select: { name: true, email: true } } } },
      },
    }),
  ]);
  const name = (u: { name: string | null; email: string }) => u.name ?? u.email;
  const missing = new Map<string, string[]>();
  for (const a of open) {
    const who = name(a.staffProfile.user);
    missing.set(who, [...(missing.get(who) ?? []), a.order.orderRef]);
  }
  return {
    entries: entries.map((e) => ({
      who: name(e.staffProfile.user),
      role: e.assignment.role,
      orderRef: e.order.orderRef,
      done: e.done,
      progress: e.progress,
      blocker: e.blocker,
      partDone: e.partDone,
    })),
    notFiled: [...missing.entries()].map(([who, refs]) => ({ who, orderRefs: refs })),
  };
}
