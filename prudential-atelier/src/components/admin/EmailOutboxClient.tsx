"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

type EmailRow = {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  provider: string | null;
  sentAt: string | null;
  createdAt: string;
  nextAttemptAt: string | null;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: string): string {
  if (status === "SENT") return "text-success";
  if (status === "DEAD") return "text-error";
  if (status === "FAILED" || status === "SENDING") return "text-warning";
  return "text-text-mid";
}

export function EmailOutboxClient() {
  const searchParams = useSearchParams();
  const relatedId = searchParams.get("relatedId")?.trim() ?? "";
  const [items, setItems] = useState<EmailRow[]>([]);
  const [deadCount, setDeadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [template, setTemplate] = useState("");
  const [to, setTo] = useState("");
  const [preview, setPreview] = useState<{ html: string; subject: string } | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (template) q.set("template", template);
    if (to) q.set("to", to);
    if (relatedId) q.set("relatedId", relatedId);
    const res = await fetch(`/api/admin/system/emails?${q.toString()}`);
    if (!res.ok) {
      toast.error("Could not load emails");
      setLoading(false);
      return;
    }
    const j = (await res.json()) as { items: EmailRow[]; deadCount: number };
    setItems(j.items);
    setDeadCount(j.deadCount);
    setLoading(false);
  }, [status, template, to, relatedId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPreview(id: string) {
    const res = await fetch(`/api/admin/system/emails/${id}`);
    if (!res.ok) {
      toast.error("Could not load preview");
      return;
    }
    const j = (await res.json()) as { item: { html: string; subject: string } };
    setPreview({ html: j.item.html, subject: j.item.subject });
  }

  async function resend(id: string) {
    setResending(id);
    try {
      const res = await fetch(`/api/admin/system/emails/${id}/resend`, { method: "POST" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(j.error ?? "Resend failed");
        return;
      }
      toast.success("Queued a new message");
      await load();
    } finally {
      setResending(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <p className="font-body text-13px text-ink">
          DEAD{" "}
          <span className="ml-1 inline-flex min-w-[1.5rem] justify-center rounded-full bg-error-soft px-2 py-0.5 text-12px text-error">
            {deadCount}
          </span>
        </p>
        <label className="font-body text-12px text-text-mid">
          Status
          <select
            className="ml-2 border border-border bg-white px-2 py-1 text-13px"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            {["QUEUED", "SENDING", "SENT", "FAILED", "DEAD"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="font-body text-12px text-text-mid">
          Template
          <input
            className="ml-2 border border-border px-2 py-1 text-13px"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          />
        </label>
        <label className="font-body text-12px text-text-mid">
          Recipient
          <input
            className="ml-2 border border-border px-2 py-1 text-13px"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <p className="font-body text-13px text-text-mid">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="pill-rows w-full min-w-[720px] text-left font-body text-13px">
            <thead>
              <tr className="border-b border-border text-text-mid">
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">To</th>
                <th className="py-2 pr-3 font-medium">Template</th>
                <th className="py-2 pr-3 font-medium">Attempts</th>
                <th className="py-2 pr-3 font-medium">Provider</th>
                <th className="py-2 pr-3 font-medium">Created</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-[#F0E6DC]">
                  <td className={`py-2 pr-3 ${statusClass(row.status)}`}>{row.status}</td>
                  <td className="py-2 pr-3">{row.to}</td>
                  <td className="py-2 pr-3">{row.template}</td>
                  <td className="py-2 pr-3">
                    {row.attempts}/{row.maxAttempts}
                  </td>
                  <td className="py-2 pr-3">{row.provider ?? "—"}</td>
                  <td className="py-2 pr-3">{formatWhen(row.createdAt)}</td>
                  <td className="py-2">
                    <button className="mr-2 text-olive underline" type="button" onClick={() => void openPreview(row.id)}>
                      Preview
                    </button>
                    <button
                      className="text-olive underline disabled:opacity-50"
                      type="button"
                      disabled={resending === row.id}
                      onClick={() => void resend(row.id)}
                    >
                      Resend
                    </button>
                    {row.lastError ? (
                      <p className="mt-1 max-w-xs text-11px text-error">{row.lastError}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 font-display text-lg">{preview.subject}</p>
            <iframe
              title="Email preview"
              // Stored mail can carry text from public forms: render it with no script and no same-origin access.
              sandbox=""
              className="h-[70vh] w-full border border-border"
              srcDoc={preview.html}
            />
            <button className="mt-3 text-13px underline" type="button" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
