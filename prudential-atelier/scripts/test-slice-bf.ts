/**
 * Slice BF — live chat, properly staffed.
 *
 *   pnpm test:slice-bf                                                   # unit (CI, no database)
 *   ALLOW_FIXTURES=true BASE_URL=http://localhost:3000 pnpm test:slice-bf  # + live HTTP against a local server
 *
 * Behaviour, not markup. The live part drives the real routes and the real
 * event stream and asserts what happens:
 * - BF1 typing arrives over the stream (latency printed), and nothing about it is stored;
 * - BF2 outside the schedule a live message is refused (409) and a left message is
 *   accepted (202) with the next opening computed; no schedule = closed;
 * - BF3 the greeting is not offered when chat is closed;
 * - BF4 name + phone is enough, name alone is not; a guest thread joins her account;
 * - BF5 "Jubilee has joined" (first name only); a second admin cannot claim a held
 *   conversation (409) or reply into it; a takeover is logged and shown to the house only;
 * - BF6 unanswered: recipients told again, then she is told nobody is free;
 * - BF7 files both ways, SVG refused, served so they cannot run, never via /media;
 * - BF8 an edit keeps the original; an edit after a reply is refused (409);
 * - BF9 recipients are set on Who is told only (Super Admin); per conversation, not per message;
 * - erase removes the file from disk — checked by looking for the file.
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { ChatAuthor, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { assertFixturesAllowed } from "./fixture-guard";
import {
  describeOpening,
  isOpenAt,
  nextOpening,
  parseClosedDates,
  parseSchedule,
  scheduleError,
  type WeeklySchedule,
} from "../src/lib/chat-hours";
import { parseChatContact } from "../src/lib/chat-shared";
import { chatMessageView, closedLine, editRefusal, parseUserIdList, staffChatName } from "../src/lib/chat";
import { activeHolder } from "../src/lib/chat-claim";
import { SSE_HEADERS } from "../src/lib/http/sse";
import { CAPABILITY_COLUMNS } from "../src/lib/capability-registry";
import { getMediaStore } from "../src/lib/media";
import { CRON_CATALOG } from "../src/lib/cron/catalog";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
  console.log(`  ok ${message}`);
}

const WEEKDAYS_9_TO_6: WeeklySchedule = {
  sun: null,
  mon: { open: "09:00", close: "18:00" },
  tue: { open: "09:00", close: "18:00" },
  wed: { open: "09:00", close: "18:00" },
  thu: { open: "09:00", close: "18:00" },
  fri: { open: "09:00", close: "18:00" },
  sat: null,
};
const ALWAYS: WeeklySchedule = Object.fromEntries(
  (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const).map((d) => [d, { open: "00:00", close: "24:00" }]),
) as WeeklySchedule;
const NEVER: WeeklySchedule = { sun: null, mon: null, tue: null, wed: null, thu: null, fri: null, sat: null };

// 1×1 PNG, a minimal PDF, and an SVG that would run script if served from our origin.
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201e221bc330000000049454e44ae426082",
  "hex",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

function unit() {
  console.log("unit: hours (Lagos, UTC+1)");
  assert(parseSchedule(null) === null && parseSchedule("") === null && parseSchedule("{not json") === null, "an unset or unreadable schedule is no schedule");
  assert(!isOpenAt(null, [], new Date()), "no schedule = closed (fails closed, like atelier_bookings_enabled)");
  assert(parseSchedule(JSON.stringify({ ...WEEKDAYS_9_TO_6, mon: { open: "18:00", close: "09:00" } })) === null, "a day closing before it opens is unreadable, so closed");
  assert(scheduleError({ ...WEEKDAYS_9_TO_6, fri: { open: "9am", close: "6pm" } }) !== null, "times must be HH:MM");
  // Wednesday 15 Oct 2026: 08:30 UTC = 09:30 Lagos.
  const wedMorning = new Date("2026-10-15T08:30:00Z");
  assert(isOpenAt(WEEKDAYS_9_TO_6, [], wedMorning), "09:30 Lagos on a Wednesday is open");
  assert(!isOpenAt(WEEKDAYS_9_TO_6, [], new Date("2026-10-15T07:30:00Z")), "08:30 Lagos is not (UTC 07:30)");
  assert(!isOpenAt(WEEKDAYS_9_TO_6, [], new Date("2026-10-15T17:00:00Z")), "18:00 Lagos is closed (close is exclusive)");
  assert(!isOpenAt(WEEKDAYS_9_TO_6, ["2026-10-15"], wedMorning), "a closed date overrides the schedule");
  // Friday 18:30 Lagos → next opening Monday 09:00 Lagos = 08:00 UTC.
  const fridayEvening = new Date("2026-10-16T17:30:00Z");
  const next = nextOpening(WEEKDAYS_9_TO_6, [], fridayEvening);
  assert(next?.toISOString() === "2026-10-19T08:00:00.000Z", `Friday evening opens next Monday 09:00 Lagos (${next?.toISOString()})`);
  assert(describeOpening(next, fridayEvening) === "Monday at 9:00", "and says so in words");
  const holiday = nextOpening(WEEKDAYS_9_TO_6, ["2026-10-19"], fridayEvening);
  assert(holiday?.toISOString() === "2026-10-20T08:00:00.000Z", "a public holiday on Monday moves it to Tuesday");
  assert(describeOpening(nextOpening(WEEKDAYS_9_TO_6, [], new Date("2026-10-15T06:00:00Z")), new Date("2026-10-15T06:00:00Z")) === "today at 9:00", "before opening: today");
  assert(nextOpening(NEVER, [], wedMorning) === null && nextOpening(null, [], wedMorning) === null, "never open: no next opening is invented");
  assert(parseClosedDates('["2026-12-25","2026-02-30","nope","2026-12-25"]').join() === "2026-12-25", "closed dates: real dates only, deduplicated");
  assert(closedLine("Monday at 9:00", { email: "a@b.co", phone: null }).includes("open again Monday at 9:00"), "the closed line carries the computed opening");

  console.log("unit: who she is (BF4)");
  assert(parseChatContact("Ada@Example.com")?.email === "ada@example.com", "an email is one way to reply");
  assert(parseChatContact("+234 803 123 4567")?.phone === "+2348031234567", "a phone number is another");
  assert(parseChatContact("0803-123-4567")?.phone === "08031234567", "local format too");
  assert(parseChatContact("hello") === null && parseChatContact("12") === null && parseChatContact("a@b") === null, "anything else is not");

  console.log("unit: names (BF5)");
  assert(staffChatName({ name: "Jubilee Okafor" }) === "Jubilee", "a stranger sees the first name only");
  assert(staffChatName({ name: "Jubilee Okafor", displayName: "Juby" }) === "Juby", "or the display name she chose");
  const now = new Date();
  assert(activeHolder({ handlerId: "u1", handlerName: "Jubilee", handlerActiveAt: now }, 10, now)?.name === "Jubilee", "an active claim holds");
  assert(activeHolder({ handlerId: "u1", handlerName: "Jubilee", handlerActiveAt: new Date(now.getTime() - 11 * 60_000) }, 10, now) === null, "an idle claim returns to the pool");

  console.log("unit: edits (BF8)");
  const sent = new Date(now.getTime() - 10_000);
  const mine = { author: ChatAuthor.VISITOR, staffUserId: null, createdAt: sent };
  assert(editRefusal({ message: mine, editor: { author: "VISITOR" }, laterAuthors: [ChatAuthor.SYSTEM], windowSec: 30, now }) === null, "her own line, inside the window, unanswered: editable (the house's automatic line is not a reply)");
  assert(editRefusal({ message: mine, editor: { author: "VISITOR" }, laterAuthors: [ChatAuthor.STAFF], windowSec: 30, now }) !== null, "answered: refused even inside the window");
  assert(editRefusal({ message: mine, editor: { author: "VISITOR" }, laterAuthors: [], windowSec: 5, now }) !== null, "outside the window: refused");
  const staffLine = { author: ChatAuthor.STAFF, staffUserId: "a", createdAt: sent };
  assert(editRefusal({ message: staffLine, editor: { author: "STAFF", userId: "b" }, laterAuthors: [], windowSec: 30, now }) !== null, "another admin's line: refused");
  assert(editRefusal({ message: staffLine, editor: { author: "STAFF", userId: "a" }, laterAuthors: [ChatAuthor.VISITOR], windowSec: 30, now }) !== null, "the house cannot edit a line she has answered either");
  const view = chatMessageView({
    id: "m",
    author: ChatAuthor.VISITOR,
    staffName: null,
    body: "I'll pay ₦2,000,000",
    createdAt: sent,
    revisions: [{ body: "I'll pay ₦200,000", createdAt: now }],
  });
  assert(view.body === "I'll pay ₦200,000" && view.editedAt && !JSON.stringify(view).includes("2,000,000"), "she sees the edit marked as edited; the original stays with the house");

  console.log("unit: stream, files, settings");
  assert(SSE_HEADERS["Cache-Control"].includes("no-transform") && SSE_HEADERS["X-Accel-Buffering"] === "no", "the stream tells every proxy not to buffer or compress it");
  assert(CRON_CATALOG.some((j) => j.name === "chat-unanswered" && j.schedule === "* * * * *"), "BF6 runs every minute");
  assert(parseUserIdList("[]") === null && parseUserIdList('["ckabcdefghij1234"]')?.length === 1, "an empty recipient list is no list");
  assert(!CAPABILITY_COLUMNS.some((c) => c.model === "ChatAttachment"), "chat files hold no token: they are reached through the conversation's own gate");
  const schema = readFileSync(resolve(__dirname, "../prisma/schema.prisma"), "utf8");
  const attachmentModel = schema.slice(schema.indexOf("model ChatAttachment {"), schema.indexOf("}", schema.indexOf("model ChatAttachment {")));
  assert(!/token/i.test(attachmentModel.replace(/\/\/\/.*$/gm, "")), "and the model has no token-shaped column");
  assert(!/typing/i.test(schema.slice(schema.indexOf("model ChatConversation {"), schema.indexOf("model GarmentType"))), "nothing about typing is stored");
  const widget = readFileSync(resolve(__dirname, "../src/components/chat/ChatWidget.tsx"), "utf8");
  assert(!/<script|src=\{?["']https?:/.test(widget), "the widget loads no external script");
  console.log("ok unit");
}

class Jar {
  m = new Map<string, string>();
  take(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const kv = c.split(";")[0];
      const i = kv.indexOf("=");
      this.m.set(kv.slice(0, i), kv.slice(i + 1));
    }
  }
  header() {
    return Array.from(this.m).map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function signIn(base: string, email: string, password: string, ip: string): Promise<Jar> {
  const jar = new Jar();
  const c = await fetch(`${base}/api/auth/csrf`, { headers: { "x-forwarded-for": ip } });
  jar.take(c);
  const { csrfToken } = (await c.json()) as { csrfToken: string };
  const r = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-auth-return-redirect": "1", "x-forwarded-for": ip, cookie: jar.header() },
    body: new URLSearchParams({ csrfToken, email, password }),
  });
  jar.take(r);
  assert(r.status === 200 && jar.m.has("authjs.session-token"), `fixture sign-in works (${email.split("@")[0]})`);
  return jar;
}

type SseEvent = { event: string; data: Record<string, unknown>; at: number };

/** Opens a real event stream and collects what arrives. */
async function openStream(url: string, cookie: string) {
  const ctrl = new AbortController();
  const res = await fetch(url, { headers: { cookie, accept: "text/event-stream" }, signal: ctrl.signal });
  const events: SseEvent[] = [];
  const done = (async () => {
    if (!res.body) return;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const ev = /^event: (.+)$/m.exec(block)?.[1];
          const data = /^data: (.+)$/m.exec(block)?.[1];
          if (ev && data) events.push({ event: ev, data: JSON.parse(data) as Record<string, unknown>, at: Date.now() });
        }
      }
    } catch {
      /* aborted */
    }
  })();
  const waitFor = async (pred: (e: SseEvent) => boolean, ms = 3000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = events.find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 20));
    }
    return null;
  };
  return { res, events, waitFor, close: () => (ctrl.abort(), done) };
}

async function live(base: string) {
  const host = new URL(base).hostname;
  assert(host === "localhost" || host === "127.0.0.1", "local server only");
  assertFixturesAllowed("test-slice-bf");
  const stamp = Date.now();
  const ip = `198.51.100.${(stamp % 200) + 20}`;
  const json = (method: string, body: unknown, cookie?: string) => ({
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const hash = await bcrypt.hash("Correct-Horse-9", 12);
  const mk = (tag: string, name: string, role: Role) =>
    prisma.user.create({ data: { email: `bf-${tag}-${stamp}@example.test`, name, role, password: hash } });
  const superAdmin = await mk("super", "Prudent Test", Role.SUPER_ADMIN);
  const jubilee = await mk("jubilee", "Jubilee Okafor", Role.ADMIN);
  const ada = await mk("ada", "Ada Nwosu", Role.ADMIN);
  const client = await mk("client", "Ngozi Client", Role.CUSTOMER);
  const keys = [
    "chat_enabled",
    "chat_retention_days",
    "chat_hours_text",
    "chat_schedule",
    "chat_closed_dates",
    "chat_greeting_delay_sec",
    "chat_edit_window_sec",
    "chat_unanswered_renotify_min",
    "chat_unanswered_giveup_min",
    "chat_claim_idle_min",
    "chat_notify_email_user_ids",
    "chat_notify_bell_user_ids",
    "admin_alert_recipients",
    "admin_alert_recipients_adopted",
  ];
  const before = await prisma.siteSetting.findMany({ where: { key: { in: keys } } });
  const convoIds: string[] = [];
  try {
    const superJar = await signIn(base, superAdmin.email, "Correct-Horse-9", ip);
    const jubJar = await signIn(base, jubilee.email, "Correct-Horse-9", ip);
    const adaJar = await signIn(base, ada.email, "Correct-Horse-9", ip);
    const settings = (body: unknown, jar = superJar) => fetch(`${base}/api/admin/chat/settings`, json("PATCH", body, jar.header()));
    const status = async () => (await (await fetch(`${base}/api/chat/status`)).json()) as { live: boolean; greetingDelaySec: number | null; opensLabel: string | null };

    console.log("live: BF9 recipients");
    assert((await settings({ enabled: true, retention: "keep", schedule: ALWAYS, editWindowSec: 30, greetingDelaySec: 15 })).status === 200, "chat on, open around the clock for the test");
    // Chosen on Settings → Who is told only; Chat → Settings no longer takes recipients.
    const whoIsTold = (channel: "email" | "bell", userIds: string[] | null, jar = superJar) =>
      fetch(`${base}/api/admin/settings/alert-recipients`, json("PUT", { kind: "chat", channel, userIds }, jar.header()));
    const ignored = await (await settings({ recipients: { email: [client.id], bell: [client.id] } })).json() as Record<string, unknown>;
    assert(!("recipients" in ignored), "Chat → Settings does not show or take recipients");
    const notSuper = await whoIsTold("email", [jubilee.id], jubJar);
    assert(notSuper.status === 403, `only the Super Admin chooses recipients (${notSuper.status})`);
    const stranger = await whoIsTold("email", [client.id]);
    assert(stranger.status === 400, `a customer cannot be a recipient (${stranger.status})`);
    assert((await whoIsTold("email", [jubilee.id])).status === 200, "named people save (email)");
    assert((await whoIsTold("bell", [jubilee.id, ada.id])).status === 200, "named people save (bell)");

    console.log("live: BF4 who she is");
    const noContact = await fetch(`${base}/api/chat`, json("POST", { name: "Ifeoma", message: "hi", path: "/" }));
    assert(noContact.status === 400, `a name alone is not enough (${noContact.status})`);
    const startRes = await fetch(`${base}/api/chat`, json("POST", { name: "Ifeoma Test", contact: "+234 803 000 1234", message: "Do you ship to Abuja?", path: "/shop" }));
    assert(startRes.status === 201, `name and a phone number start a chat (${startRes.status})`);
    const chatCookie = startRes.headers.getSetCookie().find((c) => c.startsWith("pg_chat="))!.split(";")[0];
    const convo = await prisma.chatConversation.findFirstOrThrow({ where: { visitorPhone: "+2348030001234" }, orderBy: { createdAt: "desc" } });
    convoIds.push(convo.id);
    assert(convo.visitorEmail === null, "no email was asked for");
    const notes = await prisma.adminNotification.findMany({ where: { entityId: convo.id, type: "CHAT" } });
    assert(notes.length === 1 && notes[0].targetUserIds.sort().join() === [jubilee.id, ada.id].sort().join(), "a new conversation rings the bell for exactly the people named");

    console.log("live: BF1 the stream");
    const visitorStream = await openStream(`${base}/api/chat/stream`, chatCookie);
    assert(visitorStream.res.headers.get("content-type")?.startsWith("text/event-stream"), "the visitor's stream opens");
    assert(visitorStream.res.headers.get("cache-control")?.includes("no-transform"), "with no-transform");
    assert(await visitorStream.waitFor((e) => e.event === "ready"), "and says ready");
    const adminStream = await openStream(`${base}/api/admin/chat/stream?c=${convo.id}`, jubJar.header());
    assert(await adminStream.waitFor((e) => e.event === "ready"), "the inbox stream opens");
    assert(await adminStream.waitFor((e) => e.event === "presence" && e.data.visitorOnline === true), "and knows she is here");

    let t0 = Date.now();
    await fetch(`${base}/api/admin/chat/${convo.id}/typing`, json("POST", { typing: true }, jubJar.header()));
    const typed = await visitorStream.waitFor((e) => e.event === "typing" && e.data.who === "staff", 2000);
    assert(typed && typed.data.name === "Jubilee", `she sees "Jubilee is typing" (${typed ? typed.at - t0 : "—"} ms after the keystroke)`);
    t0 = Date.now();
    await fetch(`${base}/api/chat/typing`, json("POST", { typing: true }, chatCookie));
    const theyTyped = await adminStream.waitFor((e) => e.event === "typing" && e.data.who === "visitor", 2000);
    assert(theyTyped, `the house sees her typing (${theyTyped ? theyTyped.at - t0 : "—"} ms)`);
    assert(Number(typed!.data.ttlMs) > 0 && Number(typed!.data.ttlMs) <= 6000, "typing expires on its own after a few seconds");

    console.log("live: BF5 one handler");
    const claimA = await fetch(`${base}/api/admin/chat/${convo.id}/claim`, json("POST", {}, jubJar.header()));
    assert(claimA.status === 200, `opening it to reply claims it (${claimA.status})`);
    const joinedLine = await prisma.chatMessage.findFirst({ where: { conversationId: convo.id, body: { endsWith: "has joined." } } });
    assert(joinedLine?.body === "Jubilee has joined.", `she sees "${joinedLine?.body}" — first name only`);
    assert(!joinedLine.body.includes("Okafor"), "no surname");
    assert(await visitorStream.waitFor((e) => e.event === "thread" && e.data.reason === "claim"), "and it arrives live");
    const claimB = await fetch(`${base}/api/admin/chat/${convo.id}/claim`, json("POST", {}, adaJar.header()));
    assert(claimB.status === 409, `a second admin cannot claim a held conversation (${claimB.status})`);
    const replyB = await fetch(`${base}/api/admin/chat/${convo.id}`, json("POST", { body: "Hi from Ada" }, adaJar.header()));
    assert(replyB.status === 409, `nor reply into it (${replyB.status})`);
    const readB = await fetch(`${base}/api/admin/chat/${convo.id}`, { headers: { cookie: adaJar.header() } });
    assert(readB.status === 200, "but she can read it: claiming controls who replies, never who reads");

    console.log("live: BF8 edits");
    const sentRes = await fetch(`${base}/api/chat/messages`, json("POST", { body: "I'll pay ₦2,000,000" }, chatCookie));
    const sentId = ((await sentRes.json()) as { id: string }).id;
    const edit = await fetch(`${base}/api/chat/messages/${sentId}`, json("PATCH", { body: "I'll pay ₦200,000" }, chatCookie));
    assert(edit.status === 200, `she corrects her line within 30 seconds (${edit.status})`);
    const hersNow = (await (await fetch(`${base}/api/chat`, { headers: { cookie: chatCookie } })).json()) as { messages: { id: string; body: string; editedAt: string | null }[] };
    const shown = hersNow.messages.find((m) => m.id === sentId)!;
    assert(shown.body === "I'll pay ₦200,000" && shown.editedAt, "it shows as edited");
    const houseView = (await (await fetch(`${base}/api/admin/chat/${convo.id}`, { headers: { cookie: jubJar.header() } })).json()) as {
      conversation: { messages: { id: string; original: string; body: string; revisions: unknown[] }[] };
    };
    const hv = houseView.conversation.messages.find((m) => m.id === sentId)!;
    assert(hv.original === "I'll pay ₦2,000,000" && hv.body === "I'll pay ₦200,000", "the house sees the original and the edit");
    const rewrite = await prisma.chatMessage.update({ where: { id: sentId }, data: { body: "tampered" } }).then(() => "allowed", () => "refused");
    assert(rewrite === "refused", "the database refuses to overwrite what was sent");
    const replyA = await fetch(`${base}/api/admin/chat/${convo.id}`, json("POST", { body: "Yes, we ship to Abuja." }, jubJar.header()));
    assert(replyA.status === 201, "the holder replies");
    const lateEdit = await fetch(`${base}/api/chat/messages/${sentId}`, json("PATCH", { body: "I'll pay ₦20,000" }, chatCookie));
    assert(lateEdit.status === 409, `an edit after a reply is refused, even inside the window (${lateEdit.status})`);
    const replyAId = ((await replyA.json()) as { id: string }).id;
    await fetch(`${base}/api/chat/messages`, json("POST", { body: "Thanks!" }, chatCookie));
    const staffLate = await fetch(`${base}/api/admin/chat/${convo.id}/messages/${replyAId}`, json("PATCH", { body: "No, we don't." }, jubJar.header()));
    assert(staffLate.status === 409, `the same rule for the house (${staffLate.status})`);

    console.log("live: BF9 per conversation, not per message");
    for (let i = 0; i < 3; i++) await fetch(`${base}/api/chat/messages`, json("POST", { body: `more ${i}` }, chatCookie));
    const notesAfter = await prisma.adminNotification.count({ where: { entityId: convo.id, type: "CHAT" } });
    assert(notesAfter === 1, `four more messages, still one notification (${notesAfter})`);

    console.log("live: BF5 takeover");
    const takeover = await fetch(`${base}/api/admin/chat/${convo.id}/claim`, json("POST", { takeover: true }, adaJar.header()));
    assert(takeover.status === 200, `a deliberate takeover works (${takeover.status})`);
    const log = await prisma.activityLog.findFirst({ where: { recordId: convo.id, module: "chat", description: { startsWith: "Took over" } } });
    assert(log?.userId === ada.id, "and is logged");
    const internalLine = await prisma.chatMessage.findFirst({ where: { conversationId: convo.id, internal: true } });
    assert(internalLine?.body.includes("took this conversation over from Jubilee"), "and shown in the thread to the house");
    const visitorThread = await (await fetch(`${base}/api/chat`, { headers: { cookie: chatCookie } })).text();
    assert(!visitorThread.includes("took this conversation over"), "but not to her");
    assert(visitorThread.includes("Ada has joined."), "she sees Ada join");
    const jubAfter = await fetch(`${base}/api/admin/chat/${convo.id}`, json("POST", { body: "still me?" }, jubJar.header()));
    assert(jubAfter.status === 409, `the previous holder is now the one refused (${jubAfter.status})`);
    assert((await fetch(`${base}/api/admin/chat/${convo.id}/claim`, { method: "DELETE", headers: { cookie: adaJar.header() } })).status === 200, "releasing returns it to the pool");

    console.log("live: BF7 files");
    const up = (cookie: string, url: string, bytes: Buffer, name: string, type: string) => {
      const fd = new FormData();
      fd.set("file", new Blob([new Uint8Array(bytes)], { type }), name);
      return fetch(url, { method: "POST", body: fd, headers: { cookie, "x-forwarded-for": ip } });
    };
    const svg = await up(chatCookie, `${base}/api/chat/attachments`, SVG, "logo.svg", "image/svg+xml");
    assert(svg.status === 400, `an SVG is refused (${svg.status})`);
    const disguised = await up(chatCookie, `${base}/api/chat/attachments`, SVG, "photo.png", "image/png");
    assert(disguised.status === 400, `an SVG named .png is refused too (the bytes decide) (${disguised.status})`);
    assert((await up(chatCookie, `${base}/api/chat/attachments`, PDF, "receipt.pdf", "application/pdf")).status === 201, "she sends a receipt (PDF)");
    const houseFile = await up(adaJar.header(), `${base}/api/admin/chat/${convo.id}/attachments`, PNG, "fabric.png", "image/png");
    assert(houseFile.status === 201, `the house sends a fabric photograph (${houseFile.status})`);
    const files = await prisma.chatAttachment.findMany({ where: { conversationId: convo.id }, orderBy: { createdAt: "asc" } });
    assert(files.length === 2 && files.every((f) => f.storageKey.startsWith("private/prudential-atelier/chat/")), "both stored private, in chat's own folder");
    const pdf = files.find((f) => f.mime === "application/pdf")!;
    const png = files.find((f) => f.mime === "image/png")!;
    const adminPdf = await fetch(`${base}/api/admin/chat/attachments/${pdf.id}`, { headers: { cookie: jubJar.header() } });
    assert(adminPdf.status === 200 && adminPdf.headers.get("content-type") === "application/pdf", "an admin opens her PDF");
    assert(/^attachment/.test(adminPdf.headers.get("content-disposition") ?? ""), "it downloads rather than rendering inline");
    assert(adminPdf.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(adminPdf.headers.get("content-security-policy") ?? ""), "nosniff and a sandboxing CSP");
    const herPng = await fetch(`${base}/api/chat/attachments/${png.id}`, { headers: { cookie: chatCookie } });
    assert(herPng.status === 200 && herPng.headers.get("content-type") === "image/png" && /^inline/.test(herPng.headers.get("content-disposition") ?? ""), "she sees the house's photograph inline");
    assert((await fetch(`${base}/api/chat/attachments/${png.id}`)).status === 404, "without her cookie it does not exist");
    assert((await fetch(`${base}/media/${png.storageKey}`, { headers: { cookie: superJar.header() } })).status === 404, "nor through /media, even for the Super Admin");
    const onDisk = files.map((f) => getMediaStore().absolutePath(f.storageKey)!);
    for (const p of onDisk) assert((await stat(p)).isFile(), `the file is on disk before erase (${p.split(/[\\/]/).pop()})`);

    console.log("live: BF6 when nobody comes");
    assert((await settings({ renotifyMin: 1, giveUpMin: 2 })).status === 200, "periods set (1 and 2 minutes)");
    const second = await fetch(`${base}/api/chat`, json("POST", { name: "Bisi Test", contact: `bisi-${stamp}@example.test`, message: "Hello?", path: "/" }));
    const secondCookie = second.headers.getSetCookie().find((c) => c.startsWith("pg_chat="))!.split(";")[0];
    const c2 = await prisma.chatConversation.findFirstOrThrow({ where: { visitorEmail: `bisi-${stamp}@example.test` } });
    convoIds.push(c2.id);
    const cron = () => fetch(`${base}/api/cron/chat-unanswered`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    await prisma.chatConversation.update({ where: { id: c2.id }, data: { awaitingSince: new Date(Date.now() - 90_000) } });
    assert((await cron()).status === 200, "the job runs");
    const c2a = await prisma.chatConversation.findUniqueOrThrow({ where: { id: c2.id } });
    assert(c2a.unansweredStage === 1, "after the first period the recipients are told again");
    assert((await prisma.adminNotification.count({ where: { entityId: c2.id, type: "CHAT" } })) === 2, "one more notification, no more");
    await cron();
    assert((await prisma.adminNotification.count({ where: { entityId: c2.id, type: "CHAT" } })) === 2, "running again does not repeat it");
    await prisma.chatConversation.update({ where: { id: c2.id }, data: { awaitingSince: new Date(Date.now() - 150_000) } });
    await cron();
    const herView = (await (await fetch(`${base}/api/chat`, { headers: { cookie: secondCookie } })).json()) as {
      conversation: { away: { reason: string } | null };
      messages: { body: string }[];
    };
    assert(herView.messages.some((m) => m.body.startsWith("Sorry — nobody is free")), "after the second she is told honestly that nobody is free");
    assert(herView.conversation.away?.reason === "nobody", "and the panel behaves like out of hours");

    console.log("live: BF2/BF3 hours");
    assert((await status()).live && (await status()).greetingDelaySec === 15, "open: the greeting is offered, after 15 seconds by default");
    const lagosToday = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
    assert((await settings({ closedDates: [lagosToday] })).status === 200, "today marked closed (a public holiday)");
    const closedStatus = await status();
    assert(!closedStatus.live && closedStatus.greetingDelaySec === null, "closed: no greeting");
    assert(closedStatus.opensLabel === "tomorrow at midnight", `and the next opening is computed (${closedStatus.opensLabel})`);
    const refused = await fetch(`${base}/api/chat/messages`, json("POST", { body: "anyone?" }, chatCookie));
    assert(refused.status === 409, `a live message outside the hours is refused (${refused.status})`);
    assert(((await refused.json()) as { offline?: boolean }).offline === true, "and says it is out of hours");
    const left = await fetch(`${base}/api/chat`, json("POST", { name: "Late Visitor", contact: `late-${stamp}@example.test`, message: "Are you open Saturday?", path: "/" }));
    assert(left.status === 202, `the widget still takes her message (${left.status})`);
    const leftBody = (await left.json()) as { messages: { author: string; body: string }[] };
    const line = leftBody.messages.find((m) => m.author === "SYSTEM")!.body;
    assert(line.includes("closed right now") && line.includes("tomorrow at midnight") && line.includes("by email"), `"${line}"`);
    const c3 = await prisma.chatConversation.findFirstOrThrow({ where: { visitorEmail: `late-${stamp}@example.test` } });
    convoIds.push(c3.id);
    assert(c3.offHoursAt && (await prisma.adminNotification.count({ where: { entityId: c3.id } })) === 1, "it lands in the inbox like any other, and the recipients are told");
    assert((await settings({ schedule: null, closedDates: [] })).status === 200, "hours cleared");
    assert(!(await status()).live, "no schedule: closed (fails closed)");

    console.log("live: BF4 a guest thread joins her account");
    assert((await settings({ schedule: ALWAYS })).status === 200, "open again");
    const guest = await fetch(`${base}/api/chat`, json("POST", { name: "Ngozi", contact: client.email, message: "Is my order ready?", path: "/" }));
    assert(guest.status === 201, "she writes as a guest first");
    const g = await prisma.chatConversation.findFirstOrThrow({ where: { visitorEmail: client.email } });
    convoIds.push(g.id);
    assert(g.userId === null, "a guest thread has no account");
    const clientJar = await signIn(base, client.email, "Correct-Horse-9", ip);
    assert((await prisma.chatConversation.findUniqueOrThrow({ where: { id: g.id } })).userId === client.id, "signing in with that email attaches it to her account");
    const fromAccount = await fetch(`${base}/api/chat`, { headers: { cookie: clientJar.header() } });
    const acct = (await fromAccount.json()) as { messages: { body: string }[] };
    assert(fromAccount.status === 200 && acct.messages.some((m) => m.body === "Is my order ready?"), "signed in, with no chat cookie, her dashboard opens the same conversation");
    const signedInStart = await fetch(`${base}/api/chat`, json("POST", { message: "Following up", path: "/account" }, clientJar.header()));
    assert(signedInStart.status === 201, "signed in, she types nothing but her message");
    assert((await prisma.chatConversation.count({ where: { userId: client.id } })) === 1, "and it is the same thread, not a second one");

    console.log("live: erase removes the files");
    await visitorStream.close();
    await adminStream.close();
    const erase = await fetch(`${base}/api/admin/chat/${convo.id}/erase`, json("POST", { confirmation: "DELETE", allForVisitor: false, reason: "Erasure request under the NDPA (test)" }, superJar.header()));
    const erased = (await erase.json()) as { deleted?: number; filesDeleted?: number };
    assert(erase.status === 200 && erased.deleted === 1 && erased.filesDeleted === 2, `erased with both files (${JSON.stringify(erased)})`);
    for (const p of onDisk) {
      const gone = await stat(p).then(() => false, (e: NodeJS.ErrnoException) => e.code === "ENOENT");
      assert(gone, `looked for ${p.split(/[\\/]/).pop()} on disk afterwards: not there`);
    }
    assert((await prisma.chatAttachment.count({ where: { conversationId: convo.id } })) === 0, "and no row points at them");
    convoIds.splice(convoIds.indexOf(convo.id), 1);
  } finally {
    // Leave the database as it was: settings restored, fixtures removed.
    await prisma.siteSetting.deleteMany({ where: { key: { in: keys } } });
    for (const s of before) await prisma.siteSetting.create({ data: s });
    const leftover = await prisma.chatAttachment.findMany({ where: { conversationId: { in: convoIds } }, select: { storageKey: true } });
    await prisma.chatConversation.deleteMany({ where: { id: { in: convoIds } } });
    for (const f of leftover) await getMediaStore().delete(f.storageKey);
    await prisma.adminNotification.deleteMany({ where: { entityId: { in: convoIds } } });
    await prisma.activityLog.deleteMany({ where: { userId: { in: [superAdmin.id, jubilee.id, ada.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [superAdmin.id, jubilee.id, ada.id, client.id] } } });
    // The server caches settings for a moment; ask it to drop them by saving nothing new.
    console.log("  (settings restored; fixtures removed)");
  }
}

async function main() {
  unit();
  const base = process.env.BASE_URL?.replace(/\/$/, "");
  if (base && process.env.ALLOW_FIXTURES === "true") await live(base);
  else console.log("skip live checks: set ALLOW_FIXTURES=true BASE_URL=http://localhost:…");
  console.log("OK test-slice-bf");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
