/**
 * Slice BF1 — the live layer under chat. One Node process serves the site (one
 * container), so conversations fan out through memory: no broker, no new
 * service. Nothing here is stored. Typing in particular is a signal with a
 * time-to-live, never a row, so it never reaches the transcript the house keeps.
 *
 * If the site ever runs more than one app process, this must move to Postgres
 * LISTEN/NOTIFY (same events); until then a second process would not see the
 * first one's typing.
 */

export type ChatAudience = "visitor" | "staff";

export type ChatEvent =
  /** Something in the thread changed (message, edit, file, status, join): fetch it again. */
  | { type: "thread"; reason: "message" | "edit" | "file" | "status" | "claim" | "unanswered" }
  /** Someone is typing. Shown for ttlMs unless refreshed; nothing is stored. */
  | { type: "typing"; who: "visitor" | "staff"; name: string | null; ttlMs: number }
  /** The visitor's panel connected or went away (house only). */
  | { type: "presence"; visitorOnline: boolean }
  /** The inbox list changed (house only). */
  | { type: "inbox" };

type Listener = { audience: ChatAudience; send: (e: ChatEvent) => void };

type Bus = {
  rooms: Map<string, Set<Listener>>;
  inbox: Set<(e: ChatEvent) => void>;
};

const g = globalThis as unknown as { __pgChatBus?: Bus };
// Survives dev hot reloads, so a reload does not orphan open streams.
const bus: Bus = (g.__pgChatBus ??= { rooms: new Map(), inbox: new Set() });

/** Typing lasts this long without a refresh; the widget refreshes every couple of seconds. */
export const TYPING_TTL_MS = 5000;

export function subscribeConversation(conversationId: string, audience: ChatAudience, send: (e: ChatEvent) => void): () => void {
  let room = bus.rooms.get(conversationId);
  if (!room) {
    room = new Set();
    bus.rooms.set(conversationId, room);
  }
  const listener: Listener = { audience, send };
  room.add(listener);
  if (audience === "visitor") publishToConversation(conversationId, { type: "presence", visitorOnline: true }, "staff");
  return () => {
    const r = bus.rooms.get(conversationId);
    if (!r) return;
    r.delete(listener);
    if (audience === "visitor" && !visitorConnected(conversationId)) {
      publishToConversation(conversationId, { type: "presence", visitorOnline: false }, "staff");
    }
    if (r.size === 0) bus.rooms.delete(conversationId);
  };
}

export function subscribeInbox(send: (e: ChatEvent) => void): () => void {
  bus.inbox.add(send);
  return () => bus.inbox.delete(send);
}

/** To everyone in the conversation, or one side of it. */
export function publishToConversation(conversationId: string, event: ChatEvent, audience: ChatAudience | "all" = "all"): void {
  const room = bus.rooms.get(conversationId);
  if (!room) return;
  for (const l of room) {
    if (audience !== "all" && l.audience !== audience) continue;
    try {
      l.send(event);
    } catch {
      /* a closed stream is removed by its own abort handler */
    }
  }
}

export function publishInbox(): void {
  for (const send of bus.inbox) {
    try {
      send({ type: "inbox" });
    } catch {
      /* closed */
    }
  }
}

/** A change to the thread, told to both sides and the inbox. */
export function threadChanged(conversationId: string, reason: Extract<ChatEvent, { type: "thread" }>["reason"]): void {
  publishToConversation(conversationId, { type: "thread", reason });
  publishInbox();
}

/** Her panel is open right now (a live stream). */
export function visitorConnected(conversationId: string): boolean {
  const room = bus.rooms.get(conversationId);
  if (!room) return false;
  for (const l of room) if (l.audience === "visitor") return true;
  return false;
}

/** Open streams, for the capacity note in the report and the admin. */
export function openStreamCount(): { conversations: number; streams: number; inbox: number } {
  let streams = 0;
  for (const r of bus.rooms.values()) streams += r.size;
  return { conversations: bus.rooms.size, streams, inbox: bus.inbox.size };
}
