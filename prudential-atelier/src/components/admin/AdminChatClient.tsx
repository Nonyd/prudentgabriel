"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { FileText, Paperclip } from "lucide-react";
import { AdminChatSettings } from "@/components/admin/AdminChatSettings";
import { CHAT_ATTACHMENT_ACCEPT } from "@/lib/chat-shared";

type Holder = { id: string; name: string } | null;
type Item = {
  id: string;
  visitorName: string;
  visitorEmail: string | null;
  visitorPhone: string | null;
  contextKind: "PIECE" | "SHOP" | "ORDER" | "ATELIER" | "GENERAL";
  contextLabel: string | null;
  contextPath: string;
  lastMessageAt: string;
  unread: boolean;
  holder: Holder;
  awaitingSince: string | null;
  offHoursAt: string | null;
  unansweredStage: number;
  last: { author: string; body: string } | null;
};

type Attachment = { id: string; mime: string; name: string; bytes: number };
type Message = {
  id: string;
  author: "VISITOR" | "STAFF" | "SYSTEM";
  staffName: string | null;
  staffUserId: string | null;
  internal: boolean;
  original: string;
  body: string;
  revisions: { id: string; body: string; createdAt: string }[];
  attachments: Attachment[];
  createdAt: string;
  emailedAt: string | null;
};
type Thread = Omit<Item, "unread" | "last"> & {
  status: "OPEN" | "CLOSED";
  orderRef: string | null;
  visitorOnline: boolean;
  related: { id: string; contextLabel: string | null; contextPath: string; status: string; lastMessageAt: string }[];
  messages: Message[];
};

/** Only when the live stream cannot be opened. */
const POLL_MS = 5000;
const TYPING_EVERY_MS = 2000;
/** While she is active in the thread, the holder says "still here" this often. */
const STILL_HERE_MS = 60_000;

const CONTEXT_HINT: Record<Item["contextKind"], string> = {
  ATELIER: "Started on the atelier journey. Hand her the enquiry form; do not quote, take a brief or book here.",
  PIECE: "Asking about a piece.",
  ORDER: "About an order. Check it is hers before sharing details.",
  SHOP: "Started in the shop.",
  GENERAL: "General question.",
};

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
}

function EraseControl({ id, contact, onDone }: { id: string; contact: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(true);
  const [reason, setReason] = useState("Erasure request under the NDPA");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function erase() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/chat/${id}/erase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirm, allForVisitor: all, reason }),
      });
      const j = (await r.json()) as { deleted?: number; filesDeleted?: number; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not erase");
      toast.success(
        `Erased ${j.deleted} conversation${j.deleted === 1 ? "" : "s"}${j.filesDeleted ? ` and ${j.filesDeleted} file${j.filesDeleted === 1 ? "" : "s"}` : ""}; logged`,
      );
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not erase");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-error underline">
        Erase…
      </button>
    );
  }
  return (
    <div className="mt-2 space-y-2 border border-error/30 p-3 text-xs">
      <p className="text-error">
        Erase permanently, with every file sent in it. This cannot be undone; the activity log keeps who and how many, not the
        words.
      </p>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
        Every conversation with {contact}
      </label>
      <input className="w-full border border-sand px-2 py-1" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
      <input className="w-full border border-sand px-2 py-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type DELETE" aria-label="Type DELETE" />
      <div className="flex gap-2">
        <button type="button" disabled={busy || confirm !== "DELETE"} onClick={() => void erase()} className="bg-red-800 px-3 py-1.5 uppercase text-white disabled:opacity-50">
          Erase
        </button>
        <button type="button" onClick={() => setOpen(false)} className="underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Files({ files }: { files: Attachment[] }) {
  return (
    <>
      {files.map((a) =>
        a.mime.startsWith("image/") ? (
          <a key={a.id} href={`/api/admin/chat/attachments/${a.id}`} target="_blank" rel="noopener noreferrer" className="mb-1 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/admin/chat/attachments/${a.id}`} alt={a.name} className="max-h-56 w-auto rounded-sm" loading="lazy" />
          </a>
        ) : (
          <a key={a.id} href={`/api/admin/chat/attachments/${a.id}`} className="mb-1 flex items-center gap-1.5 underline" download>
            <FileText className="h-4 w-4 shrink-0" />
            {a.name} <span className="opacity-70">({Math.ceil(a.bytes / 1024)} KB, downloads)</span>
          </a>
        ),
      )}
    </>
  );
}

export function AdminChatClient({ openId }: { openId: string | null }) {
  const { data: session } = useSession();
  const me = session?.user?.id ?? null;
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const [status, setStatus] = useState<"OPEN" | "CLOSED">("OPEN");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(openId);
  const [thread, setThread] = useState<Thread | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [visitorTyping, setVisitorTyping] = useState(false);
  const [colleagueTyping, setColleagueTyping] = useState<string | null>(null);
  const [visitorOnline, setVisitorOnline] = useState(false);
  const [mode, setMode] = useState<"stream" | "poll" | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [editWindowSec, setEditWindowSec] = useState(30);
  const lastTyping = useRef(0);
  const lastActive = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pages 1..page are kept on screen: "Load more" extends, live updates refresh the same span.
  const loadList = useCallback(async () => {
    const all: Item[] = [];
    let more = false;
    for (let p = 1; p <= page; p++) {
      const qs = new URLSearchParams({ status, page: String(p) });
      if (query.trim()) qs.set("q", query.trim());
      const r = await fetch(`/api/admin/chat?${qs.toString()}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { items: Item[]; hasMore: boolean };
      all.push(...j.items);
      more = j.hasMore;
      if (!j.hasMore) break;
    }
    setItems(all);
    setHasMore(more);
  }, [status, query, page]);

  const loadThread = useCallback(async () => {
    if (!selected) return setThread(null);
    const r = await fetch(`/api/admin/chat/${selected}`, { cache: "no-store" });
    if (r.ok) {
      const t = ((await r.json()) as { conversation: Thread }).conversation;
      setThread(t);
      setVisitorOnline(t.visitorOnline);
    }
  }, [selected]);

  useEffect(() => {
    void fetch("/api/admin/chat/settings")
      .then((r) => r.json())
      .then((j: { editWindowSec?: number }) => j.editWindowSec !== undefined && setEditWindowSec(j.editWindowSec))
      .catch(() => {});
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    setEditing(null);
    setVisitorTyping(false);
    setColleagueTyping(null);
    void loadThread();
  }, [loadThread]);

  // BF1: one live line for the open conversation (and the inbox); polling if it cannot be opened.
  const listRef = useRef(loadList);
  const threadRef = useRef(loadThread);
  listRef.current = loadList;
  threadRef.current = loadThread;
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: number | null = null;
    let opened = false;
    let failures = 0;
    let typingClear: number | null = null;
    let colleagueClear: number | null = null;
    const startPolling = () => {
      es?.close();
      es = null;
      setMode("poll");
      if (poll === null) {
        poll = window.setInterval(() => {
          void listRef.current();
          void threadRef.current();
        }, POLL_MS);
      }
    };
    if (typeof EventSource === "undefined") startPolling();
    else {
      es = new EventSource(`/api/admin/chat/stream${selected ? `?c=${encodeURIComponent(selected)}` : ""}`);
      const openTimer = window.setTimeout(() => !opened && startPolling(), 6000);
      es.addEventListener("ready", () => {
        opened = true;
        failures = 0;
        window.clearTimeout(openTimer);
        setMode("stream");
      });
      es.addEventListener("inbox", () => void listRef.current());
      es.addEventListener("thread", () => {
        setVisitorTyping(false);
        void threadRef.current();
      });
      es.addEventListener("presence", (ev) => {
        setVisitorOnline((JSON.parse((ev as MessageEvent<string>).data) as { visitorOnline: boolean }).visitorOnline);
      });
      es.addEventListener("typing", (ev) => {
        const e = JSON.parse((ev as MessageEvent<string>).data) as { who: string; name: string | null; ttlMs: number };
        if (e.who === "visitor") {
          if (typingClear !== null) window.clearTimeout(typingClear);
          setVisitorTyping(e.ttlMs > 0);
          if (e.ttlMs > 0) typingClear = window.setTimeout(() => setVisitorTyping(false), e.ttlMs);
        } else if (e.name) {
          if (colleagueClear !== null) window.clearTimeout(colleagueClear);
          setColleagueTyping(e.ttlMs > 0 ? e.name : null);
          if (e.ttlMs > 0) colleagueClear = window.setTimeout(() => setColleagueTyping(null), e.ttlMs);
        }
      });
      es.onerror = () => {
        failures += 1;
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
      if (colleagueClear !== null) window.clearTimeout(colleagueClear);
    };
  }, [selected]);

  const iHold = Boolean(thread?.holder && me && thread.holder.id === me);
  const heldByOther = Boolean(thread?.holder && me && thread.holder.id !== me);

  // BF5: while she is active in a thread she holds, keep the claim alive; idle, it lapses.
  useEffect(() => {
    if (!selected || !iHold) return;
    const mark = () => {
      lastActive.current = Date.now();
    };
    window.addEventListener("keydown", mark);
    window.addEventListener("pointerdown", mark);
    const t = window.setInterval(() => {
      if (Date.now() - lastActive.current < STILL_HERE_MS) {
        void fetch(`/api/admin/chat/${selected}/claim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      }
    }, STILL_HERE_MS);
    return () => {
      window.removeEventListener("keydown", mark);
      window.removeEventListener("pointerdown", mark);
      window.clearInterval(t);
    };
  }, [selected, iHold]);

  async function claim(takeover = false): Promise<boolean> {
    if (!selected) return false;
    const r = await fetch(`/api/admin/chat/${selected}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ takeover }),
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) {
      toast.error(j.error ?? "Could not claim");
      await loadThread();
      return false;
    }
    lastActive.current = Date.now();
    await loadThread();
    return true;
  }

  async function release() {
    if (!selected) return;
    await fetch(`/api/admin/chat/${selected}/claim`, { method: "DELETE" });
    await Promise.all([loadThread(), loadList()]);
  }

  function onReplyChange(v: string) {
    setReply(v);
    lastActive.current = Date.now();
    const now = Date.now();
    if (selected && v.trim() && now - lastTyping.current > TYPING_EVERY_MS) {
      lastTyping.current = now;
      void fetch(`/api/admin/chat/${selected}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing: true }),
      });
    }
  }

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
      const j = (await r.json()) as { emailed?: boolean; phoneOnly?: string | null; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not send");
      if (j.emailed) toast.success("She had left, so the reply was also emailed");
      if (j.phoneOnly) toast(`She has left and gave only a phone number: ${j.phoneOnly}`);
      setReply("");
      await loadThread();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
      await loadThread();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !editing?.text.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/chat/${selected}/messages/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editing.text }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not edit");
      setEditing(null);
      await loadThread();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not edit");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    if (!selected) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await fetch(`/api/admin/chat/${selected}/attachments`, { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not send the file");
      await loadThread();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the file");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
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

  function canEdit(m: Message, i: number): boolean {
    if (!thread || m.author !== "STAFF" || m.staffUserId !== me) return false;
    if (Date.now() - new Date(m.createdAt).getTime() > editWindowSec * 1000) return false;
    return !thread.messages.slice(i + 1).some((x) => x.author === "VISITOR");
  }

  const contact = thread ? thread.visitorEmail ?? thread.visitorPhone ?? "" : "";

  return (
    <div data-chat-mode={mode ?? undefined}>
      <AdminChatSettings />
      <div className="mt-4 flex flex-wrap items-center gap-2 font-body text-11px">
        <input
          className="min-w-[220px] flex-1 border border-sand px-3 py-1.5 text-sm"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search open and closed: name, email, phone, order, piece"
          aria-label="Search conversations"
        />
        {(["OPEN", "CLOSED"] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={Boolean(query.trim())}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={clsx("admin-chip glass-1 glass-pill uppercase tracking-[0.08em]", status === s ? "border-[var(--glass-edge-bright)] text-choc" : "text-ink")}
          >
            {s === "OPEN" ? "Open" : "Closed"}
          </button>
        ))}
        <span className="text-10px text-text-mid">{mode === "stream" ? "Live" : mode === "poll" ? "Refreshing every few seconds" : ""}</span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
          {items.length === 0 ? <li className="font-body text-sm text-text-mid">No conversations.</li> : null}
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c.id)}
                className={clsx("w-full rounded-none border p-3 text-left font-body text-sm", selected === c.id ? "border-ink" : "border-sand", c.unread && "bg-warning-soft")}
              >
                <span className="flex justify-between gap-2">
                  <strong className="text-ink">{c.visitorName}</strong>
                  <span className="text-10px text-text-mid">{new Date(c.lastMessageAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                </span>
                <span className="block text-11px uppercase tracking-[0.06em] text-text-mid">
                  {c.contextKind === "ATELIER" ? "Atelier" : c.contextLabel ?? c.contextPath}
                </span>
                {c.last ? <span className="mt-1 block truncate text-xs text-text-mid">{c.last.body}</span> : null}
                <span className="mt-1 flex flex-wrap gap-x-2 text-10px">
                  {c.holder ? <span className="text-choc">{c.holder.id === me ? "You are handling" : `${c.holder.name} is handling`}</span> : null}
                  {c.awaitingSince ? (
                    <span className={c.unansweredStage >= 1 ? "text-error" : "text-text-mid"}>
                      Waiting {ago(c.awaitingSince)}
                      {c.offHoursAt ? " · out of hours" : c.unansweredStage >= 2 ? " · told nobody is free" : ""}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
          {hasMore ? (
            <li>
              <button type="button" onClick={() => setPage((p) => p + 1)} className="w-full border border-sand py-2 text-xs uppercase">
                Load more
              </button>
            </li>
          ) : null}
        </ul>
        <div className="glass-1 min-h-[50vh] p-4">
          {!thread ? (
            <p className="font-body text-sm text-text-mid">Choose a conversation.</p>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-sand pb-3 font-body text-sm">
                <p className="text-ink">
                  <strong>{thread.visitorName}</strong>
                  {thread.visitorEmail ? ` · ${thread.visitorEmail}` : ""}
                  {thread.visitorPhone ? ` · ${thread.visitorPhone}` : ""}
                  <span className={clsx("ml-2 text-xs", visitorOnline ? "text-success" : "text-text-mid")}>
                    {visitorOnline ? "● Here now" : "○ Not on the page"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-text-mid">
                  Started on <code>{thread.contextPath}</code>
                  {thread.contextLabel ? ` · ${thread.contextLabel}` : ""}
                  {!thread.visitorEmail ? " · No email: reply by phone or WhatsApp if she leaves" : ""}
                </p>
                <p className={clsx("mt-2 text-xs", thread.contextKind === "ATELIER" ? "font-medium text-error" : "text-text-mid")}>
                  {CONTEXT_HINT[thread.contextKind]}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" data-chat-holder={thread.holder?.name ?? ""}>
                  {thread.holder ? (
                    <span className="text-choc">{iHold ? "You are handling this conversation." : `${thread.holder.name} is handling this conversation.`}</span>
                  ) : (
                    <span className="text-text-mid">Nobody is handling it. Starting a reply claims it.</span>
                  )}
                  {heldByOther ? (
                    <button type="button" onClick={() => void claim(true)} className="rounded-sm border border-sand px-2 py-1 uppercase text-ink">
                      Take over
                    </button>
                  ) : null}
                  {iHold ? (
                    <button type="button" onClick={() => void release()} className="rounded-sm border border-sand px-2 py-1 uppercase text-ink">
                      Release
                    </button>
                  ) : null}
                </div>
                {thread.related.length ? (
                  <p className="mt-2 text-xs text-text-mid">
                    Her other conversations:{" "}
                    {thread.related.map((r, i) => (
                      <button key={r.id} type="button" className="underline" onClick={() => setSelected(r.id)}>
                        {i ? ", " : ""}
                        {r.contextLabel ?? r.contextPath} ({new Date(r.lastMessageAt).toLocaleDateString("en-GB")})
                      </button>
                    ))}
                  </p>
                ) : null}
                {isSuperAdmin ? (
                  <div className="mt-2">
                    <EraseControl
                      id={thread.id}
                      contact={contact}
                      onDone={() => {
                        setSelected(null);
                        void loadList();
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto py-3">
                {thread.messages.map((m, i) => (
                  <div
                    key={m.id}
                    className={clsx(
                      "max-w-[80%]",
                      m.author === "STAFF" ? "ml-auto" : m.author === "SYSTEM" ? "mx-auto text-center" : "",
                    )}
                  >
                    <div
                      className={clsx(
                        "whitespace-pre-line rounded-sm px-3 py-2 font-body text-sm",
                        m.author === "STAFF"
                          ? "bg-[#37392d] text-white"
                          : m.author === "SYSTEM"
                            ? clsx("bg-transparent text-xs italic text-text-mid", m.internal && "border border-dashed border-sand")
                            : "bg-sand/40 text-ink",
                      )}
                    >
                      {m.author === "STAFF" && m.staffName ? <span className="mb-0.5 block text-10px uppercase opacity-70">{m.staffName}</span> : null}
                      {m.internal ? <span className="mr-1 not-italic">Only the house sees this:</span> : null}
                      <Files files={m.attachments} />
                      {m.body}
                      {m.revisions.length ? (
                        // BF8: the original and every edit, so nothing said is quietly changed.
                        <span className="mt-1 block border-t border-current/20 pt-1 text-10px opacity-80" data-chat-edited>
                          Edited {m.revisions.length === 1 ? "once" : `${m.revisions.length} times`}. Originally: &ldquo;{m.original}&rdquo;
                          {m.revisions.slice(0, -1).map((r) => (
                            <span key={r.id} className="block">
                              then &ldquo;{r.body}&rdquo;
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {m.emailedAt ? <span className="mt-1 block text-10px opacity-70">Also emailed</span> : null}
                    </div>
                    {canEdit(m, i) && m.body ? (
                      <button type="button" className="mt-0.5 block w-full text-right text-10px text-text-mid underline" onClick={() => setEditing({ id: m.id, text: m.body })}>
                        Edit
                      </button>
                    ) : null}
                  </div>
                ))}
                {visitorTyping ? <p className="font-body text-xs italic text-text-mid" data-chat-typing>{thread.visitorName.split(/\s+/)[0]} is typing…</p> : null}
                {colleagueTyping ? <p className="font-body text-xs italic text-text-mid">{colleagueTyping} is typing…</p> : null}
              </div>
              {editing ? (
                <form onSubmit={saveEdit} className="flex gap-2 border-t border-sand pt-3">
                  <textarea className="input-field min-h-[60px] flex-1 text-sm" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} aria-label="Edit message" />
                  <div className="flex flex-col gap-2">
                    <button type="submit" disabled={busy} className="rounded-sm bg-[#37392d] px-4 py-2 text-xs uppercase text-white disabled:opacity-50">
                      Save edit
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="rounded-sm border border-sand px-4 py-2 text-xs uppercase text-ink">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={send} className="flex gap-2 border-t border-sand pt-3">
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
                  <textarea
                    className="input-field min-h-[60px] flex-1 text-sm"
                    value={reply}
                    disabled={heldByOther}
                    onFocus={() => {
                      // BF5: opening a conversation to reply claims it.
                      if (!iHold && !heldByOther) void claim(false);
                    }}
                    onChange={(e) => onReplyChange(e.target.value)}
                    placeholder={heldByOther ? `${thread.holder?.name} is handling this. Take it over to reply.` : "Reply"}
                    aria-label="Reply"
                  />
                  <div className="flex flex-col gap-2">
                    <button type="submit" disabled={busy || !reply.trim() || heldByOther} className="rounded-sm bg-[#37392d] px-4 py-2 text-xs uppercase text-white disabled:opacity-50">
                      Send
                    </button>
                    <button
                      type="button"
                      disabled={busy || heldByOther}
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center justify-center gap-1 rounded-sm border border-sand px-4 py-2 text-xs uppercase text-ink disabled:opacity-50"
                    >
                      <Paperclip className="h-3.5 w-3.5" /> File
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
