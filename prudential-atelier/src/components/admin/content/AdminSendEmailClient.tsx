"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { EmailRichTextEditor } from "@/components/admin/content/EmailRichTextEditor";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { EMAIL_TEMPLATE_KEYS, type EmailTemplateKey } from "@/lib/admin-email-catalog";
import type { StoredEmailTemplate } from "@/lib/admin-email-template-store";

type SourceId =
  | "newsletter"
  | "customers"
  | "rtw_purchasers"
  | "collection_buyers"
  | "gold_platinum"
  | "active_orders"
  | "upcoming_consultations"
  | "specific"
  | "custom";

type ClientResult = { id: string; name: string; email: string };
type CollectionOpt = { id: string; name: string; slug: string };

const SOURCE_OPTIONS: { id: SourceId; label: string }[] = [
  { id: "newsletter", label: "Newsletter subscribers" },
  { id: "customers", label: "Registered customers" },
  { id: "rtw_purchasers", label: "Past RTW purchasers" },
  { id: "collection_buyers", label: "Buyers of a collection" },
  { id: "gold_platinum", label: "Gold + Platinum members" },
  { id: "active_orders", label: "Clients with active atelier orders" },
  { id: "upcoming_consultations", label: "Upcoming consultations" },
  { id: "specific", label: "Specific client" },
  { id: "custom", label: "Custom email address" },
];

export function AdminSendEmailClient({
  templates,
}: {
  templates: Record<EmailTemplateKey, StoredEmailTemplate>;
}) {
  const [sources, setSources] = useState<Set<SourceId>>(new Set<SourceId>(["newsletter"]));
  const [recipientCount, setRecipientCount] = useState(0);
  const [suppressed, setSuppressed] = useState(0);
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<ClientResult[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [customEmail, setCustomEmail] = useState("");
  const [collections, setCollections] = useState<CollectionOpt[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ sent: number; total: number; pending?: number } | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isCollectionTpl = templateKey === EMAIL_TEMPLATE_KEYS.COLLECTION_CAMPAIGN;
  const templateList = Object.values(templates).sort((a, b) => a.label.localeCompare(b.label));

  function toggleSource(id: SourceId) {
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const refreshCount = useCallback(async () => {
    if (sources.size === 0) {
      setRecipientCount(0);
      setSuppressed(0);
      return;
    }
    if (sources.has("specific") && !selectedClient) {
      setRecipientCount(0);
      return;
    }
    if (sources.has("custom") && !customEmail) {
      setRecipientCount(0);
      return;
    }
    const params = new URLSearchParams({ sources: Array.from(sources).join(",") });
    if (sources.has("specific") && selectedClient) params.set("specificUserId", selectedClient.id);
    if (sources.has("custom") && customEmail) params.set("customEmail", customEmail);
    if ((sources.has("collection_buyers") || isCollectionTpl) && collectionId) {
      params.set("collectionId", collectionId);
    }
    const res = await fetch(`/api/admin/send-email/recipients?${params}`);
    if (!res.ok) return;
    const j = (await res.json()) as { count: number; suppressed?: number };
    setRecipientCount(j.count);
    setSuppressed(j.suppressed ?? 0);
  }, [sources, selectedClient, customEmail, collectionId, isCollectionTpl]);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    void fetch("/api/admin/collections")
      .then((r) => r.json())
      .then((j: { collections?: CollectionOpt[] }) => setCollections(j.collections ?? []));
  }, []);

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
        .then((j: { sent: number; total: number; pending?: number; status: string }) => {
          setProgress({ sent: j.sent, total: j.total, pending: j.pending });
          if (j.status === "done" || j.status === "failed") {
            clearInterval(interval);
            if (j.status === "done") toast.success(`Campaign finished (${j.sent} sent)`);
          }
        });
    }, 4000);
    return () => clearInterval(interval);
  }, [jobId]);

  function applyTemplate(key: string) {
    setTemplateKey(key);
    const t = templates[key as EmailTemplateKey];
    if (!t) return;
    setSubject(t.subject);
    if (key === EMAIL_TEMPLATE_KEYS.COLLECTION_CAMPAIGN) {
      setBody("");
      return;
    }
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

  async function preview() {
    const res = await fetch("/api/admin/send-email/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        body,
        templateKey: templateKey || undefined,
        collectionId: collectionId || undefined,
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      toast.error((j as { error?: string }).error ?? "Preview failed");
      return;
    }
    setPreviewHtml((j as { html: string }).html);
  }

  async function testSend() {
    const res = await fetch("/api/admin/send-email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        body,
        templateKey: templateKey || undefined,
        collectionId: collectionId || undefined,
      }),
    });
    const j = await res.json();
    if (!res.ok) toast.error((j as { error?: string }).error ?? "Test failed");
    else toast.success(`Test queued to ${(j as { to: string }).to}`);
  }

  async function send() {
    if (recipientCount < 1) {
      toast.error("No recipients");
      return;
    }
    if (!subject.trim() && !isCollectionTpl) {
      toast.error("Subject is required");
      return;
    }
    if (!isCollectionTpl && !body.trim()) {
      toast.error("Message is required");
      return;
    }
    if ((isCollectionTpl || sources.has("collection_buyers")) && !collectionId) {
      toast.error("Select a collection");
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
          sources: Array.from(sources),
          specificUserId: selectedClient?.id,
          customEmail: sources.has("custom") ? customEmail : undefined,
          collectionId: collectionId || undefined,
          subject: subject || "Collection",
          body,
          templateKey: templateKey || undefined,
          confirmCount: recipientCount,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Send failed");
      if (j.jobId) {
        setJobId(j.jobId as string);
        setProgress({ sent: 0, total: j.recipientCount as number });
        toast.success(`Queued ${j.recipientCount as number} emails. You can leave this page.`);
      } else {
        toast.success("Queued");
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
          <p className="mt-1 font-body text-[12px] text-[#6B6B68]">
            Combine lists — duplicates and unsubscribed or bounced addresses are removed.
          </p>
          <div className="mt-3 space-y-2">
            {SOURCE_OPTIONS.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={sources.has(opt.id)}
                  onChange={() => toggleSource(opt.id)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <p className="mt-3 font-body text-sm text-ink">
            Send to <strong>{recipientCount}</strong> recipients
            {suppressed > 0 ? (
              <span className="text-[#6B6B68]"> ({suppressed} suppressed)</span>
            ) : null}
          </p>
        </div>

        {sources.has("specific") ? (
          <div>
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

        {sources.has("custom") ? (
          <input
            value={customEmail}
            onChange={(e) => setCustomEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full rounded-sm border border-sand px-3 py-2 text-sm"
          />
        ) : null}

        <div>
          <label className="block text-xs text-[#6B6B68]">
            Collection
            <select
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="mt-1 w-full rounded-sm border border-sand bg-white px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-[11px] text-[#6B6B68]">
            Required for a collection launch template or the “buyers of a collection” list.
          </p>
        </div>

        <div>
          <label className="block text-xs text-[#6B6B68]">
            Template (optional)
            <select
              value={templateKey}
              onChange={(e) => applyTemplate(e.target.value)}
              className="mt-1 w-full rounded-sm border border-sand bg-white px-3 py-2 text-sm"
            >
              <option value="">Write a custom message…</option>
              {templateList.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!isCollectionTpl ? (
          <>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full rounded-sm border border-sand px-3 py-2 text-sm"
            />
            <EmailRichTextEditor value={body} onChange={setBody} />
          </>
        ) : (
          <p className="font-body text-[13px] text-[#6B6B68]">
            Collection launch copy is edited under Content → Email Templates. This send uses that
            template with the selected collection’s cover and products.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void preview()}
            className="border border-sand px-4 py-2 font-body text-[12px] uppercase tracking-wide"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => void testSend()}
            className="border border-sand px-4 py-2 font-body text-[12px] uppercase tracking-wide"
          >
            Send test to myself
          </button>
          <button
            type="button"
            disabled={sending || recipientCount < 1}
            onClick={() => setConfirmOpen(true)}
            className="bg-[#37392d] px-4 py-2 font-body text-[12px] uppercase tracking-wide text-white disabled:opacity-40"
          >
            {sending ? "Queueing…" : `Send to ${recipientCount} recipients`}
          </button>
        </div>

        {jobId ? (
          <p className="font-body text-[13px] text-[#6B6B68]">
            Queued. Drain sends in the background
            {progress ? ` — ${progress.sent} of ${progress.total} delivered` : null}.{" "}
            <Link href={`/admin/system/emails?relatedId=${jobId}`} className="text-olive underline">
              Watch in Emails
            </Link>
          </p>
        ) : null}
      </div>

      {previewHtml ? (
        <div className="mt-6 border border-sand bg-white">
          <div className="flex justify-between border-b border-sand px-3 py-2">
            <p className="font-body text-[12px] uppercase text-[#6B6B68]">Preview</p>
            <button type="button" className="text-[12px] text-olive" onClick={() => setPreviewHtml(null)}>
              Close
            </button>
          </div>
          <iframe title="Email preview" className="h-[640px] w-full" srcDoc={previewHtml} />
        </div>
      ) : null}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Send to ${recipientCount} recipients?`}
        description="This queues marketing email. Unsubscribed and bounced addresses are skipped. You can leave the page — sending continues on the server."
        confirmLabel={`Send to ${recipientCount}`}
        variant="warning"
        onConfirm={() => void send()}
        loading={sending}
      />
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
