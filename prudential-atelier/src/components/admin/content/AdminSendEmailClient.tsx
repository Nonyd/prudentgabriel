"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { EmailRichTextEditor } from "@/components/admin/content/EmailRichTextEditor";
import type { EmailTemplateKey } from "@/lib/admin-email-catalog";
import type { StoredEmailTemplate } from "@/lib/admin-email-template-store";

type RecipientType =
  | "specific"
  | "all"
  | "gold_platinum"
  | "active_orders"
  | "upcoming_consultations"
  | "custom";

type ClientResult = { id: string; name: string; email: string };

const RECIPIENT_OPTIONS: { id: RecipientType; label: string }[] = [
  { id: "specific", label: "Specific client" },
  { id: "all", label: "All clients (registered customers)" },
  { id: "gold_platinum", label: "Gold + Platinum members only" },
  { id: "active_orders", label: "Clients with active atelier orders" },
  { id: "upcoming_consultations", label: "Clients with upcoming consultations" },
  { id: "custom", label: "Custom email address" },
];

export function AdminSendEmailClient({
  templates,
}: {
  templates: Record<EmailTemplateKey, StoredEmailTemplate>;
}) {
  const [recipientType, setRecipientType] = useState<RecipientType>("all");
  const [recipientCount, setRecipientCount] = useState(0);
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<ClientResult[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [customEmail, setCustomEmail] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);

  const templateList = Object.values(templates).sort((a, b) => a.label.localeCompare(b.label));

  const refreshCount = useCallback(async () => {
    if (recipientType === "specific" && !selectedClient) {
      setRecipientCount(0);
      return;
    }
    if (recipientType === "custom") {
      setRecipientCount(customEmail ? 1 : 0);
      return;
    }
    const params = new URLSearchParams({ recipientType });
    if (recipientType === "specific" && selectedClient) {
      params.set("specificUserId", selectedClient.id);
    }
    const res = await fetch(`/api/admin/send-email/recipients?${params}`);
    if (!res.ok) return;
    const j = (await res.json()) as { count: number };
    setRecipientCount(j.count);
  }, [recipientType, selectedClient, customEmail]);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (clientQuery.length < 2) {
      setClientResults([]);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/admin/clients/search?q=${encodeURIComponent(clientQuery)}`)
        .then((r) => r.json())
        .then((j: { items: ClientResult[] }) => setClientResults(j.items ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [clientQuery]);

  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(() => {
      void fetch(`/api/admin/send-email/${jobId}/status`)
        .then((r) => r.json())
        .then((j: { sent: number; total: number; status: string }) => {
          setProgress({ sent: j.sent, total: j.total });
          if (j.status === "done" || j.status === "failed") {
            clearInterval(interval);
            if (j.status === "done") toast.success(`Email sent to ${j.sent} recipients`);
          }
        });
    }, 1500);
    return () => clearInterval(interval);
  }, [jobId]);

  function applyTemplate(key: string) {
    setTemplateKey(key);
    const t = templates[key as EmailTemplateKey];
    if (!t) return;
    setSubject(t.subject);
    const html = [
      t.heading ? `<h2>${escapeHtml(t.heading)}</h2>` : "",
      t.body_1 ? `<p>${escapeHtml(t.body_1).replace(/\n/g, "<br/>")}</p>` : "",
      t.body_2 ? `<p>${escapeHtml(t.body_2).replace(/\n/g, "<br/>")}</p>` : "",
      t.cta_label && t.cta_link
        ? `<p><a href="${escapeHtml(t.cta_link)}">${escapeHtml(t.cta_label)}</a></p>`
        : "",
      t.footer_note ? `<p><em>${escapeHtml(t.footer_note)}</em></p>` : "",
    ].join("");
    setBody(html);
  }

  async function send() {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setSending(true);
    setJobId(null);
    setProgress(null);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientType,
          specificUserId: selectedClient?.id,
          customEmail: recipientType === "custom" ? customEmail : undefined,
          subject,
          body,
          templateKey: templateKey || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Send failed");
      if (j.jobId) {
        setJobId(j.jobId as string);
        setProgress({ sent: 0, total: j.recipientCount as number });
      } else {
        toast.success("Email sent");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-[720px]">
      <div className="space-y-6 rounded-sm border border-sand bg-[#FAFAFA] p-6">
        <div>
          <p className="font-label text-xs uppercase tracking-widest text-gold">To</p>
          <div className="mt-3 space-y-2">
            {RECIPIENT_OPTIONS.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="recipientType"
                  checked={recipientType === opt.id}
                  onChange={() => setRecipientType(opt.id)}
                />
                {opt.label}
                {recipientType === opt.id && opt.id !== "specific" && opt.id !== "custom" ? (
                  <span className="text-xs text-[#6B6B68]">({recipientCount} recipients)</span>
                ) : null}
              </label>
            ))}
          </div>

          {recipientType === "specific" ? (
            <div className="mt-3">
              <input
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Search client by name or email"
                className="w-full rounded-sm border border-sand px-3 py-2 text-sm"
              />
              {clientResults.length > 0 ? (
                <ul className="mt-2 border border-sand bg-white">
                  {clientResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClient(c);
                          setClientQuery(c.name);
                          setClientResults([]);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-sand/40"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-[#6B6B68]">{c.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {recipientType === "custom" ? (
            <input
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              placeholder="email@example.com"
              className="mt-3 w-full rounded-sm border border-sand px-3 py-2 text-sm"
            />
          ) : null}
        </div>

        <div>
          <label className="block text-xs text-[#6B6B68]">
            Use template (optional)
            <select
              value={templateKey}
              onChange={(e) => applyTemplate(e.target.value)}
              className="mt-1 w-full rounded-sm border border-sand bg-white px-3 py-2 text-sm"
            >
              <option value="">Select a template…</option>
              {templateList.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-xs text-[#6B6B68]">
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-sm border border-sand bg-white px-3 py-2 text-sm"
          />
        </label>

        <div>
          <p className="text-xs text-[#6B6B68]">Message</p>
          <div className="mt-1">
            <EmailRichTextEditor value={body} onChange={setBody} />
          </div>
        </div>

        {progress ? (
          <p className="text-sm text-ink">
            Sending… {progress.sent} / {progress.total}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="rounded-sm border border-sand px-4 py-2 text-sm text-ink"
          >
            Preview
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => void send()}
            className="rounded-sm bg-wine px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send email →"}
          </button>
        </div>
      </div>

      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-sm bg-white p-6">
            <h3 className="font-display text-lg text-ink">Email preview</h3>
            <p className="mt-2 text-sm font-medium text-gold">{subject}</p>
            <div
              className="prose prose-sm mt-4 max-w-none border border-sand p-4"
              dangerouslySetInnerHTML={{ __html: body }}
            />
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="mt-4 text-sm text-olive underline"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
