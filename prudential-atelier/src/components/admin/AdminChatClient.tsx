"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";

type Item = {
  id: string;
  visitorName: string;
  visitorEmail: string;
  contextKind: "PIECE" | "SHOP" | "ORDER" | "ATELIER" | "GENERAL";
  contextLabel: string | null;
  contextPath: string;
  lastMessageAt: string;
  unread: boolean;
  last: { author: string; body: string } | null;
};

type Message = { id: string; author: "VISITOR" | "STAFF" | "SYSTEM"; staffName: string | null; body: string; createdAt: string; emailedAt: string | null };
type Thread = Item & { status: "OPEN" | "CLOSED"; orderRef: string | null; messages: Message[] };
type Settings = { enabled: boolean; retentionDays: number | null; hoursText: string };

const POLL_MS = 5000;

const CONTEXT_HINT: Record<Item["contextKind"], string> = {
  ATELIER: "Started on the atelier journey. Hand her the enquiry form; do not quote, take a brief or book here.",
  PIECE: "Asking about a piece.",
  ORDER: "About an order. Check it is hers before sharing details.",
  SHOP: "Started in the shop.",
  GENERAL: "General question.",
};

function ChatSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [days, setDays] = useState("");
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/chat/settings")
      .then((r) => r.json())
      .then((j: Settings) => {
        setS(j);
        setDays(j.retentionDays ? String(j.retentionDays) : "");
        setHours(j.hoursText);
      });
  }, []);

  async function save(enabled: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/chat/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, retentionDays: days.trim() ? Number(days) : null, hoursText: hours }),
      });
      const j = (await res.json()) as Settings & { error?: unknown };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not save");
      setS(j);
      toast.success(j.enabled ? "Chat is on" : "Saved — chat is off");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (!s) return null;
  return (
    <details className="mt-4 glass-1 p-4 font-body text-sm" open={!s.enabled}>
      <summary className="cursor-pointer text-ink">
        Settings — chat is <strong>{s.enabled ? "on" : "off"}</strong>
      </summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-xs text-[#6B6B68]">
          Keep conversations for (days) — required before chat can be switched on
          <input
            inputMode="numeric"
            className="mt-1 w-full border border-sand px-3 py-2 text-sm text-ink"
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Set by Mrs. Prudent"
          />
        </label>
        <label className="block text-xs text-[#6B6B68]">
          Who answers and when (shown to visitors)
          <input
            className="mt-1 w-full border border-sand px-3 py-2 text-sm text-ink"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            maxLength={400}
            placeholder="e.g. We answer Monday to Saturday, 9am–6pm WAT. Otherwise we reply by email."
          />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-sm bg-[#37392d] px-4 py-2 text-xs uppercase text-white disabled:opacity-50">
          Save and switch on
        </button>
        <button type="button" disabled={busy} onClick={() => void save(false)} className="rounded-sm border border-sand px-4 py-2 text-xs uppercase text-ink">
          Save, keep off
        </button>
      </div>
    </details>
  );
}

export function AdminChatClient({ openId }: { openId: string | null }) {
  const [status, setStatus] = useState<"OPEN" | "CLOSED">("OPEN");
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(openId);
  const [thread, setThread] = useState<Thread | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const r = await fetch(`/api/admin/chat?status=${status}`, { cache: "no-store" });
    if (r.ok) setItems(((await r.json()) as { items: Item[] }).items);
  }, [status]);

  const loadThread = useCallback(async () => {
    if (!selected) return setThread(null);
    const r = await fetch(`/api/admin/chat/${selected}`, { cache: "no-store" });
    if (r.ok) setThread(((await r.json()) as { conversation: Thread }).conversation);
  }, [selected]);

  useEffect(() => {
    void loadList();
    void loadThread();
    const t = window.setInterval(() => {
      void loadList();
      void loadThread();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [loadList, loadThread]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/chat/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const j = (await r.json()) as { emailed?: boolean; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not send");
      if (j.emailed) toast.success("She had left, so the reply was also emailed");
      setReply("");
      await loadThread();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  async function setThreadStatus(next: "OPEN" | "CLOSED") {
    if (!selected) return;
    await fetch(`/api/admin/chat/${selected}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await Promise.all([loadList(), loadThread()]);
  }

  return (
    <div>
      <ChatSettings />
      <div className="mt-4 flex gap-2 font-body text-[11px]">
        {(["OPEN", "CLOSED"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={clsx("admin-chip glass-1 glass-pill uppercase tracking-[0.08em]", status === s ? "border-[var(--glass-edge-bright)] text-choc" : "text-ink")}
          >
            {s === "OPEN" ? "Open" : "Closed"}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
          {items.length === 0 ? <li className="font-body text-sm text-[#6B6B68]">No conversations.</li> : null}
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c.id)}
                className={clsx("w-full border p-3 text-left font-body text-sm", selected === c.id ? "border-ink" : "border-sand", c.unread && "bg-amber-50")}
              >
                <span className="flex justify-between gap-2">
                  <strong className="text-ink">{c.visitorName}</strong>
                  <span className="text-[10px] text-[#6B6B68]">{new Date(c.lastMessageAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                </span>
                <span className="block text-[11px] uppercase tracking-[0.06em] text-[#6B6B68]">
                  {c.contextKind === "ATELIER" ? "Atelier" : c.contextLabel ?? c.contextPath}
                </span>
                {c.last ? <span className="mt-1 block truncate text-xs text-[#6B6B68]">{c.last.body}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <div className="glass-1 min-h-[50vh] p-4">
          {!thread ? (
            <p className="font-body text-sm text-[#6B6B68]">Choose a conversation.</p>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-sand pb-3 font-body text-sm">
                <p className="text-ink">
                  <strong>{thread.visitorName}</strong> · {thread.visitorEmail}
                </p>
                <p className="mt-1 text-xs text-[#6B6B68]">
                  Started on <code>{thread.contextPath}</code>
                  {thread.contextLabel ? ` · ${thread.contextLabel}` : ""}
                </p>
                <p className={clsx("mt-2 text-xs", thread.contextKind === "ATELIER" ? "font-medium text-red-800" : "text-[#6B6B68]")}>
                  {CONTEXT_HINT[thread.contextKind]}
                </p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto py-3">
                {thread.messages.map((m) => (
                  <div
                    key={m.id}
                    className={clsx(
                      "max-w-[80%] whitespace-pre-line rounded-sm px-3 py-2 font-body text-sm",
                      m.author === "STAFF" ? "ml-auto bg-[#37392d] text-white" : m.author === "SYSTEM" ? "mx-auto bg-transparent text-xs italic text-[#6B6B68]" : "bg-sand/40 text-ink",
                    )}
                  >
                    {m.body}
                    {m.emailedAt ? <span className="mt-1 block text-[10px] opacity-70">Also emailed</span> : null}
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="flex gap-2 border-t border-sand pt-3">
                <textarea className="input-field min-h-[60px] flex-1 text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply" />
                <div className="flex flex-col gap-2">
                  <button type="submit" disabled={busy || !reply.trim()} className="rounded-sm bg-[#37392d] px-4 py-2 text-xs uppercase text-white disabled:opacity-50">
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={() => void setThreadStatus(thread.status === "OPEN" ? "CLOSED" : "OPEN")}
                    className="rounded-sm border border-sand px-4 py-2 text-xs uppercase text-ink"
                  >
                    {thread.status === "OPEN" ? "Close" : "Reopen"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
