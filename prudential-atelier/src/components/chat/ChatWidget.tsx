"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { FileText, MessageCircle, Paperclip, X } from "lucide-react";
import clsx from "clsx";
import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_GREETING_FROM,
  CHAT_GREETING_SESSION_KEY,
  CHAT_GREETING_TEXT,
  CHAT_MESSAGE_MAX,
  type ChatMessageView,
  type ChatStatusView,
} from "@/lib/chat-shared";
import { xhrPostFormData } from "@/lib/admin-upload-xhr";
import { UploadProgressBar } from "@/components/ui/UploadProgressBar";

/** Only when the live stream cannot be opened. */
const POLL_MS = 4000;
/** No "ready" from the stream by then: it is blocked or buffered — poll instead. */
const STREAM_OPEN_TIMEOUT_MS = 6000;
/** How often she tells the house she is still typing (the signal lasts ~5s). */
const TYPING_EVERY_MS = 2000;

type Away = { reason: "hours" | "nobody"; opensLabel: string | null } | null;
type Thread = {
  messages: ChatMessageView[];
  hours: string;
  contextLabel: string | null;
  away: Away;
  contact: { email: string | null; phone: string | null };
};
type ThreadJson = {
  error?: string;
  messages?: ChatMessageView[];
  hours?: string;
  conversation?: { contextLabel: string | null; away: Away; contact: { email: string | null; phone: string | null } };
};

function toThread(j: ThreadJson): Thread | null {
  if (!j.messages || !j.conversation) return null;
  return {
    messages: j.messages,
    hours: j.hours ?? "",
    contextLabel: j.conversation.contextLabel,
    away: j.conversation.away,
    contact: j.conversation.contact,
  };
}

/** Links in house messages (e.g. the enquiry form) are shown as links. */
function withLinks(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part.replace(/[.,)]+$/, "")} className="underline">
        {part.replace(/^https?:\/\/[^/]+/, "") || part}
      </a>
    ) : (
      part
    ),
  );
}

function routeText(c: { email: string | null; phone: string | null }) {
  return c.email ? "by email" : c.phone ? "by phone" : "as soon as we can";
}

/** After the page has loaded and gone idle — never during the first paint. */
function whenSettled(cb: () => void): () => void {
  let cancelled = false;
  let idle: number | null = null;
  const run = () => {
    if (cancelled) return;
    const ric = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    idle = ric ? ric(() => !cancelled && cb(), { timeout: 4000 }) : window.setTimeout(() => !cancelled && cb(), 300);
  };
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", run);
    if (idle !== null) {
      const cic = (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (cic) cic(idle);
      else window.clearTimeout(idle);
    }
  };
}

function readGreetingDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(CHAT_GREETING_SESSION_KEY) === "dismissed";
  } catch {
    return false;
  }
}

function dismissGreetingForVisit() {
  try {
    window.sessionStorage.setItem(CHAT_GREETING_SESSION_KEY, "dismissed");
  } catch {
    /* private mode: it simply may show again on the next page */
  }
}

/**
 * BA5 + BF: first-party chat on every storefront page and her dashboard (the
 * same conversation on both). It only talks to this site.
 *
 * - Real time over one server-sent stream per open conversation (messages,
 *   edits, files, the house typing, someone joining). If the stream cannot be
 *   opened it polls instead: fewer features, never a broken panel.
 * - Out of hours it still opens and takes her message (BF2).
 * - A guest gives a name and one of email or phone; a signed-in client types
 *   nothing (BF4).
 * - The greeting (BF3) only when someone is there, once per visit, after the
 *   page has settled.
 */
export function ChatWidget() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ChatStatusView | null>(null);
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<Thread | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState(false);
  const [staffTyping, setStaffTyping] = useState<string | null>(null);
  const [mode, setMode] = useState<"stream" | "poll" | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [, setTick] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingSent = useRef(0);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/status", { cache: "no-store" });
      if (r.ok) setStatus((await r.json()) as ChatStatusView);
    } catch {
      /* offline: the launcher still opens */
    }
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/chat", { cache: "no-store" });
    if (res.status === 404 || res.status === 403) {
      setThread(null);
      return;
    }
    if (!res.ok) return;
    const t = toThread((await res.json()) as ThreadJson);
    if (t) {
      setThread((prev) => {
        // A message from the house ends its typing indicator.
        const lastStaff = [...t.messages].reverse().find((m) => m.author === "STAFF");
        if (lastStaff && !prev?.messages.some((m) => m.id === lastStaff.id)) setStaffTyping(null);
        return t;
      });
    }
  }, []);

  // BF3: once the page has settled, ask whether anyone is there (and the greeting delay).
  useEffect(() => whenSettled(() => void loadStatus()), [loadStatus]);

  // The greeting: only when chat is live, once per visit, never while the panel is open.
  useEffect(() => {
    if (!status?.live || status.greetingDelaySec === null || open || readGreetingDismissed()) return;
    let poll: number | null = null;
    // On a phone the cookie banner already fills the bottom of the screen; the greeting
    // waits for it to go rather than landing on the page's content.
    const bannerOnPhone = () =>
      window.matchMedia("(max-width: 639px)").matches &&
      Boolean(document.documentElement.style.getPropertyValue("--cookie-banner-offset"));
    const show = () => {
      if (readGreetingDismissed()) return;
      if (!bannerOnPhone()) return setGreeting(true);
      poll = window.setInterval(() => {
        if (bannerOnPhone()) return;
        if (poll !== null) window.clearInterval(poll);
        poll = null;
        if (!readGreetingDismissed()) setGreeting(true);
      }, 1000);
    };
    const t = window.setTimeout(show, status.greetingDelaySec * 1000);
    return () => {
      window.clearTimeout(t);
      if (poll !== null) window.clearInterval(poll);
    };
  }, [status, open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void Promise.all([refresh(), status ? null : loadStatus()]).finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [open, refresh, loadStatus, status]);

  // BF1: the live line while the panel is open on a conversation; polling if it cannot be opened.
  const hasThread = Boolean(thread);
  useEffect(() => {
    if (!open || !hasThread) return;
    let es: EventSource | null = null;
    let poll: number | null = null;
    let opened = false;
    let failures = 0;
    let typingClear: number | null = null;
    const startPolling = () => {
      es?.close();
      es = null;
      setMode("poll");
      if (poll === null) poll = window.setInterval(() => void refresh(), POLL_MS);
    };
    if (typeof EventSource === "undefined") {
      startPolling();
    } else {
      es = new EventSource("/api/chat/stream");
      const openTimer = window.setTimeout(() => {
        if (!opened) startPolling();
      }, STREAM_OPEN_TIMEOUT_MS);
      es.addEventListener("ready", () => {
        opened = true;
        failures = 0;
        window.clearTimeout(openTimer);
        setMode("stream");
        void refresh(); // anything missed while connecting
      });
      es.addEventListener("thread", () => void refresh());
      es.addEventListener("typing", (ev) => {
        const e = JSON.parse((ev as MessageEvent<string>).data) as { name: string | null; ttlMs: number; who: string };
        if (e.who !== "staff") return;
        if (typingClear !== null) window.clearTimeout(typingClear);
        if (e.ttlMs <= 0) return setStaffTyping(null);
        setStaffTyping(e.name ?? "Prudent Gabriel");
        typingClear = window.setTimeout(() => setStaffTyping(null), e.ttlMs);
      });
      es.onerror = () => {
        failures += 1;
        // Never opened, closed for good (404, 403, a proxy refusing it), or flapping: poll.
        if (!opened || es?.readyState === EventSource.CLOSED || failures >= 3) {
          window.clearTimeout(openTimer);
          startPolling();
        }
      };
    }
    return () => {
      es?.close();
      if (poll !== null) window.clearInterval(poll);
      if (typingClear !== null) window.clearTimeout(typingClear);
      setMode(null);
    };
  }, [open, hasThread, refresh]);

  // Re-render while open so "Edit" disappears when its window closes.
  useEffect(() => {
    if (!open || !thread) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 5000);
    return () => window.clearInterval(t);
  }, [open, thread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length, open, staffTyping]);

  function openPanel() {
    setGreeting(false);
    dismissGreetingForVisit();
    setOpen(true);
  }

  function signalTyping(value: string) {
    setDraft(value);
    if (!thread || thread.away?.reason === "hours") return;
    const now = Date.now();
    if (value.trim() && now - lastTypingSent.current > TYPING_EVERY_MS) {
      lastTypingSent.current = now;
      void fetch("/api/chat/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing: true }),
      }).catch(() => {});
    }
    if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(status?.account ? {} : { name, contact }),
          message: draft,
          path: pathname,
          orderRef: pathname.startsWith("/track") ? searchParams.get("ref") ?? undefined : undefined,
        }),
      });
      const t = toThread((await res.json()) as ThreadJson);
      if (!res.ok || !t) throw new Error("Could not start the chat. Check your name and email or phone.");
      setThread(t);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the chat");
    } finally {
      setBusy(false);
    }
  }

  /** Out of hours a message is left (202) through the same route that starts a chat. */
  async function leaveMessage(body: string) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: body, path: pathname }),
    });
    const t = toThread((await res.json()) as ThreadJson);
    if (!res.ok || !t) throw new Error("Could not send");
    setThread(t);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (thread?.away?.reason === "hours") {
        await leaveMessage(draft);
      } else {
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: draft }),
        });
        if (res.status === 409) {
          // The house closed while the panel was open: leave it as a message instead.
          await leaveMessage(draft);
          void loadStatus();
        } else if (!res.ok) {
          throw new Error("Could not send");
        } else {
          await refresh();
        }
      }
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/messages/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editing.text }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not edit");
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not edit");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setUploadProgress(0);
    try {
      const fd = new FormData();
      fd.set("file", file);
      await xhrPostFormData("/api/chat/attachments", fd, { onProgress: setUploadProgress, credentials: true });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the file");
    } finally {
      setBusy(false);
      setUploadProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function canEdit(m: ChatMessageView, i: number): boolean {
    if (m.author !== "VISITOR" || !thread || !status) return false;
    if (Date.now() - new Date(m.createdAt).getTime() > status.editWindowSec * 1000) return false;
    return !thread.messages.slice(i + 1).some((x) => x.author === "STAFF");
  }

  const closedNow = status ? !status.live : false;
  const opensLabel = thread?.away?.opensLabel ?? status?.opensLabel ?? null;

  return (
    <div
      className="pointer-events-none fixed right-4 z-[60] flex flex-col items-end gap-3 print:hidden"
      // Above the cookie banner while it shows (it sets the offset).
      style={{ bottom: "calc(1rem + var(--chat-extra-offset, 0px) + var(--cookie-banner-offset, 0px))" }}
      data-chat-mode={mode ?? undefined}
    >
      {greeting && !open ? (
        <div
          role="status"
          aria-live="polite"
          // Phones: in the launcher's own row, to its left, so it covers nothing new. Wider: stacked above it.
          className="chat-greeting glass-2 glass-panel pointer-events-auto max-sm:absolute max-sm:bottom-0 max-sm:right-14 max-sm:h-12 max-sm:w-[min(17rem,calc(100vw-5.5rem))] max-sm:px-3 max-sm:py-1.5 sm:relative sm:w-[17rem] sm:px-4 sm:py-3"
          data-chat-greeting
        >
          <button
            type="button"
            onClick={() => {
              setGreeting(false);
              dismissGreetingForVisit();
            }}
            aria-label="Dismiss"
            className="absolute right-1.5 top-1.5 p-1 text-text-mid"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={openPanel} className="block w-full pr-4 text-left">
            <span className="block font-sans text-[10px] uppercase leading-tight tracking-[0.14em] text-text-mid">{CHAT_GREETING_FROM}</span>
            <span className="block truncate font-body text-[13px] leading-snug text-ink sm:mt-1 sm:whitespace-normal sm:text-sm">{CHAT_GREETING_TEXT}</span>
          </button>
        </div>
      ) : null}

      {open ? (
        <div
          className="glass-3 glass-panel pointer-events-auto flex h-[min(520px,75vh)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden"
          role="dialog"
          aria-label="Chat with Prudent Gabriel"
        >
          <div className="flex items-center justify-between border-b border-sand px-4 py-3">
            <div>
              <p className="font-serif text-lg text-choc">Chat with Prudent Gabriel</p>
              {thread?.contextLabel ? <p className="font-body text-xs text-text-light">{thread.contextLabel}</p> : null}
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="p-1 text-text-mid">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!loaded ? (
            <p className="p-4 font-body text-sm text-text-mid">Loading…</p>
          ) : thread ? (
            <>
              {thread.away ? (
                <p className="border-b border-sand bg-sand/30 px-4 py-2 font-body text-xs leading-relaxed text-ink" data-chat-away={thread.away.reason}>
                  {thread.away.reason === "hours"
                    ? `We're closed right now${opensLabel ? ` and open again ${opensLabel} (Lagos time)` : ""}. Anything you add here reaches us, and we'll reply ${routeText(thread.contact)}.`
                    : `Nobody is free to answer right now. We'll reply ${routeText(thread.contact)} — you can keep writing here.`}
                </p>
              ) : null}
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {thread.messages.map((m, i) => (
                  <div key={m.id} className={clsx("max-w-[85%]", m.author === "VISITOR" ? "ml-auto" : "")}>
                    <div
                      className={clsx(
                        "whitespace-pre-line rounded-sm px-3 py-2 font-body text-sm",
                        m.author === "VISITOR" ? "bg-choc text-cream" : "bg-sand/40 text-ink",
                      )}
                    >
                      {m.author === "STAFF" && m.staffName ? (
                        <span className="mb-0.5 block text-[10px] uppercase tracking-[0.1em] opacity-70">{m.staffName}</span>
                      ) : null}
                      {m.attachments.map((a) =>
                        a.mime.startsWith("image/") ? (
                          <a key={a.id} href={`/api/chat/attachments/${a.id}`} target="_blank" rel="noopener noreferrer" className="mb-1 block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/chat/attachments/${a.id}`} alt={a.name} className="max-h-48 w-auto rounded-sm" loading="lazy" />
                          </a>
                        ) : (
                          <a key={a.id} href={`/api/chat/attachments/${a.id}`} className="mb-1 flex items-center gap-1.5 underline" download>
                            <FileText className="h-4 w-4 shrink-0" />
                            {a.name}
                          </a>
                        ),
                      )}
                      {m.body ? withLinks(m.body) : null}
                    </div>
                    {m.editedAt || canEdit(m, i) ? (
                      <p className={clsx("mt-0.5 font-body text-[10px] text-text-light", m.author === "VISITOR" && "text-right")}>
                        {m.editedAt ? "Edited" : null}
                        {canEdit(m, i) && m.body ? (
                          <button type="button" className="ml-2 underline" onClick={() => setEditing({ id: m.id, text: m.body })}>
                            Edit
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                ))}
                {staffTyping ? (
                  <p className="font-body text-xs italic text-text-mid" aria-live="polite" data-chat-typing>
                    {staffTyping} is typing…
                  </p>
                ) : null}
                <div ref={endRef} />
              </div>
              {thread.hours ? <p className="px-4 pb-1 font-body text-[11px] text-text-light">{thread.hours}</p> : null}
              {editing ? (
                <form onSubmit={saveEdit} className="flex gap-2 border-t border-sand p-3">
                  <input
                    className="input-field flex-1 text-sm"
                    value={editing.text}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    maxLength={CHAT_MESSAGE_MAX}
                    aria-label="Edit message"
                    autoFocus
                  />
                  <button type="submit" disabled={busy} className="rounded-sm bg-nut px-3 text-xs text-cream disabled:opacity-50">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="text-xs text-text-mid underline">
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  {uploadProgress !== null ? (
                    <div className="px-3 pt-2">
                      <UploadProgressBar value={uploadProgress} label="Attachment" tone="storefront" />
                    </div>
                  ) : null}
                  <form onSubmit={send} className="flex gap-2 border-t border-sand p-3">
                    <input
                      ref={fileRef}
                      type="file"
                      accept={CHAT_ATTACHMENT_ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void upload(f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={busy}
                      aria-label="Send a photo or PDF"
                      className="px-1 text-text-mid disabled:opacity-50"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      className="input-field flex-1 text-sm"
                      value={draft}
                      onChange={(e) => signalTyping(e.target.value)}
                      maxLength={CHAT_MESSAGE_MAX}
                      placeholder={thread.away?.reason === "hours" ? "Add to your message" : "Write a message"}
                      aria-label="Message"
                    />
                    <button type="submit" disabled={busy || !draft.trim()} className="rounded-sm bg-nut px-3 text-xs text-cream disabled:opacity-50">
                      Send
                    </button>
                  </form>
                </>
              )}
            </>
          ) : (
            <form onSubmit={start} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              {closedNow ? (
                <p className="font-body text-sm text-ink" data-chat-away="hours">
                  We&apos;re closed right now{opensLabel ? ` and open again ${opensLabel} (Lagos time)` : ""}. Leave your message and
                  we&apos;ll reply.
                </p>
              ) : (
                <p className="font-body text-sm text-text-mid">
                  Questions about a piece, your order, sizing or delivery? We&apos;ll reply here, or by email or phone if you close this page.
                </p>
              )}
              {status?.account ? (
                <p className="font-body text-xs text-text-mid">Signed in as {status.account.name}. We&apos;ll reply to your account.</p>
              ) : (
                <>
                  <input className="input-field text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required minLength={2} aria-label="Your name" />
                  <input
                    className="input-field text-sm"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Email or phone number"
                    autoComplete="email"
                    inputMode="email"
                    required
                    aria-label="Email or phone number"
                  />
                </>
              )}
              <textarea
                className="input-field min-h-[90px] text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={CHAT_MESSAGE_MAX}
                placeholder="How can we help?"
                required
                aria-label="Your message"
              />
              <button type="submit" disabled={busy} className="rounded-sm bg-nut py-2.5 font-sans text-[11px] uppercase tracking-[0.14em] text-cream disabled:opacity-50">
                {busy ? "Sending…" : closedNow ? "Leave a message" : "Start chat"}
              </button>
              <p className="font-body text-[11px] leading-relaxed text-text-light">
                Starting a chat keeps one cookie so this conversation stays open. See the{" "}
                <a href="/privacy-policy#live-chat" className="underline">
                  privacy policy
                </a>
                .
              </p>
            </form>
          )}
          {error ? (
            <p className="px-4 pb-3 font-body text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-choc text-cream shadow-lg"
        aria-label={open ? "Close chat" : "Chat with Prudent Gabriel"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
