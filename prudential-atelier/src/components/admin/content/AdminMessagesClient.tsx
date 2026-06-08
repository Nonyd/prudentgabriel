"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { EmailRichTextEditor } from "@/components/admin/content/EmailRichTextEditor";

type Message = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  isRead: boolean;
  isReplied: boolean;
  repliedAt: string | null;
  replyNote: string | null;
  createdAt: string;
};

export function AdminMessagesClient() {
  const [items, setItems] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Message | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyNote, setReplyNote] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    const params = new URLSearchParams({ filter, search });
    const res = await fetch(`/api/admin/messages?${params}`);
    if (!res.ok) return;
    const j = (await res.json()) as { items: Message[]; unreadCount: number };
    setItems(j.items);
    setUnreadCount(j.unreadCount);
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function openMessage(id: string) {
    setSelectedId(id);
    const res = await fetch(`/api/admin/messages/${id}`);
    if (!res.ok) {
      toast.error("Could not load message");
      return;
    }
    const j = (await res.json()) as { item: Message };
    setDetail(j.item);
    setReplyNote(j.item.replyNote ?? "");
    void loadList();
  }

  async function markAllRead() {
    const res = await fetch("/api/admin/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    if (!res.ok) {
      toast.error("Could not mark all read");
      return;
    }
    toast.success("All messages marked read");
    void loadList();
  }

  async function sendReply() {
    if (!detail || !replyBody.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/messages/${detail.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyBody }),
      });
      if (!res.ok) throw new Error("Send failed");
      toast.success("Reply sent");
      setReplyBody("");
      void openMessage(detail.id);
      void loadList();
    } catch {
      toast.error("Could not send reply");
    } finally {
      setSending(false);
    }
  }

  async function saveNote() {
    if (!detail) return;
    const res = await fetch(`/api/admin/messages/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isReplied: true, replyNote }),
    });
    if (!res.ok) {
      toast.error("Could not save note");
      return;
    }
    toast.success("Internal note saved");
    void openMessage(detail.id);
  }

  async function deleteMessage() {
    if (!detail || !confirm("Delete this message?")) return;
    const res = await fetch(`/api/admin/messages/${detail.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    setDetail(null);
    setSelectedId(null);
    void loadList();
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink">
            <strong>{unreadCount}</strong> unread message{unreadCount === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="text-xs text-olive underline"
          >
            Mark all read
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {["all", "unread", "read", "replied"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-sm px-3 py-1 text-xs capitalize ${
                filter === f ? "bg-choc text-cream" : "border border-sand text-[#6B6B68]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages…"
          className="mt-4 w-full rounded-sm border border-sand px-3 py-2 text-sm"
        />

        <div className="mt-4 divide-y divide-sand border border-sand bg-white">
          {loading ? (
            <p className="p-4 text-sm text-[#6B6B68]">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-[#6B6B68]">No messages yet.</p>
          ) : (
            items.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => void openMessage(m.id)}
                className={`w-full px-4 py-3 text-left hover:bg-[#FAFAFA] ${
                  selectedId === m.id ? "bg-[#FAFAFA]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {!m.isRead ? <span className="h-2 w-2 rounded-full bg-wine" /> : null}
                    <span className={m.isRead ? "text-sm text-ink" : "text-sm font-semibold text-ink"}>
                      {m.name}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-[#6B6B68]">
                    {new Date(m.createdAt).toLocaleDateString("en-GB")}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-gold">{m.subject}</p>
                <p className="mt-1 line-clamp-2 text-xs text-[#6B6B68]">{m.message}</p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-sm border border-sand bg-[#FAFAFA] p-5">
        {!detail ? (
          <p className="text-sm text-[#6B6B68]">Select a message to view details.</p>
        ) : (
          <>
            <div className="border-b border-sand pb-4">
              <h2 className="font-display text-lg text-ink">{detail.name}</h2>
              <p className="text-sm text-[#6B6B68]">{detail.email}</p>
              {detail.phone ? <p className="text-sm text-[#6B6B68]">{detail.phone}</p> : null}
              <p className="mt-2 text-xs text-[#6B6B68]">
                {new Date(detail.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}
              </p>
              <p className="mt-4 font-label text-xs text-gold">Subject</p>
              <p className="text-sm text-ink">{detail.subject}</p>
              <p className="mt-4 font-label text-xs text-gold">Message</p>
              <p className="whitespace-pre-wrap text-sm text-ink">{detail.message}</p>
            </div>

            <div className="mt-6 space-y-4">
              <p className="font-label text-xs uppercase tracking-widest text-gold">Send email reply</p>
              <EmailRichTextEditor value={replyBody} onChange={setReplyBody} placeholder="Write your reply…" />
              <button
                type="button"
                disabled={sending}
                onClick={() => void sendReply()}
                className="rounded-sm bg-wine px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send reply →"}
              </button>

              <p className="font-label text-xs uppercase tracking-widest text-gold">Internal reply note</p>
              <textarea
                rows={3}
                value={replyNote}
                onChange={(e) => setReplyNote(e.target.value)}
                className="w-full rounded-sm border border-sand px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void saveNote()}
                className="rounded-sm border border-sand px-4 py-2 text-sm text-ink"
              >
                Save note
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-sand pt-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setDetail(null);
                }}
                className="text-xs text-olive underline"
              >
                ← Back to messages
              </button>
              <button
                type="button"
                onClick={() =>
                  void fetch(`/api/admin/messages/${detail.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isRead: false }),
                  }).then(() => void openMessage(detail.id))
                }
                className="text-xs text-[#6B6B68] underline"
              >
                Mark as unread
              </button>
              <button type="button" onClick={() => void deleteMessage()} className="text-xs text-wine underline">
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
