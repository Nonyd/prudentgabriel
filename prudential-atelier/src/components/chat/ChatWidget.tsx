"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import clsx from "clsx";
import { CHAT_MESSAGE_MAX, type ChatMessageView } from "@/lib/chat-shared";

const POLL_MS = 4000;

type Thread = { messages: ChatMessageView[]; hours: string; contextLabel: string | null };

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

/**
 * BA5: first-party chat on every storefront page. Name and email before the
 * conversation; the page it started on (and the piece or order) is sent once,
 * at the start — never a trail of later pages. It only talks to this site.
 */
export function ChatWidget() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<Thread | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/chat", { cache: "no-store" });
    if (res.status === 404 || res.status === 403) {
      setThread(null);
      return;
    }
    if (!res.ok) return;
    const j = (await res.json()) as { messages: ChatMessageView[]; hours: string; conversation: { contextLabel: string | null } };
    setThread({ messages: j.messages, hours: j.hours, contextLabel: j.conversation.contextLabel });
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void refresh().finally(() => alive && setLoaded(true));
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [open, refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length, open]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          message: draft,
          path: pathname,
          orderRef: pathname.startsWith("/track") ? searchParams.get("ref") ?? undefined : undefined,
        }),
      });
      const j = (await res.json()) as {
        error?: string;
        messages?: ChatMessageView[];
        hours?: string;
        conversation?: { contextLabel: string | null };
      };
      if (!res.ok || !j.messages) throw new Error(j.error ?? "Could not start the chat");
      setThread({ messages: j.messages, hours: j.hours ?? "", contextLabel: j.conversation?.contextLabel ?? null });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the chat");
    } finally {
      setBusy(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      if (!res.ok) throw new Error("Could not send");
      setDraft("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed right-4 z-[60] flex flex-col items-end gap-3 print:hidden"
      // Above the cookie banner while it shows (it sets the offset).
      style={{ bottom: "calc(1rem + var(--cookie-banner-offset, 0px))" }}
    >
      {open ? (
        <div
          className="glass-3 glass-panel flex h-[min(520px,75vh)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden"
          role="dialog"
          aria-label="Chat with the house"
        >
          <div className="flex items-center justify-between border-b border-sand px-4 py-3">
            <div>
              <p className="font-serif text-lg text-choc">Chat with the house</p>
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
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {thread.messages.map((m) => (
                  <div
                    key={m.id}
                    className={clsx(
                      "max-w-[85%] whitespace-pre-line rounded-sm px-3 py-2 font-body text-sm",
                      m.author === "VISITOR" ? "ml-auto bg-choc text-cream" : "bg-sand/40 text-ink",
                    )}
                  >
                    {m.author === "STAFF" && m.staffName ? (
                      <span className="mb-0.5 block text-[10px] uppercase tracking-[0.1em] opacity-70">{m.staffName}</span>
                    ) : null}
                    {withLinks(m.body)}
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              {thread.hours ? <p className="px-4 pb-1 font-body text-[11px] text-text-light">{thread.hours}</p> : null}
              <form onSubmit={send} className="flex gap-2 border-t border-sand p-3">
                <input
                  className="input-field flex-1 text-sm"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={CHAT_MESSAGE_MAX}
                  placeholder="Write a message"
                  aria-label="Message"
                />
                <button type="submit" disabled={busy || !draft.trim()} className="rounded-sm bg-nut px-3 text-xs text-cream disabled:opacity-50">
                  Send
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={start} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              <p className="font-body text-sm text-text-mid">
                Questions about a piece, your order, sizing or delivery? Leave your name and email so we can reply even if
                you close this page.
              </p>
              <input className="input-field text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required minLength={2} />
              <input className="input-field text-sm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" required />
              <textarea
                className="input-field min-h-[90px] text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={CHAT_MESSAGE_MAX}
                placeholder="How can we help?"
                required
              />
              <button type="submit" disabled={busy} className="rounded-sm bg-nut py-2.5 font-sans text-[11px] uppercase tracking-[0.14em] text-cream disabled:opacity-50">
                {busy ? "Starting…" : "Start chat"}
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
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-choc text-cream shadow-lg"
        aria-label={open ? "Close chat" : "Chat with the house"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
