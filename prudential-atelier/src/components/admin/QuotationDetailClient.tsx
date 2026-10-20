"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { QuoteStatus } from "@prisma/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { asInvoiceCurrency, formatInvoiceCurrency } from "@/lib/invoice";

type VersionRow = {
  id: string;
  quoteRef: string;
  version: number;
  status: QuoteStatus;
  total: number;
  totalDelta: number;
  createdAt: string;
  revisedByUser: { id: string; name: string | null; email: string } | null;
  createdByUser: { id: string; name: string | null; email: string } | null;
};

type QuoteDetail = {
  id: string;
  quoteRef: string;
  baseQuoteRef: string;
  version: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
  currency?: string;
  status: QuoteStatus;
  notes: string | null;
  sentAt: string | null;
  approvalUrl: string | null;
  pdfUrl: string | null;
  approvalToken: string;
  createdAt: string;
  invoices: Array<{ id: string; invoiceNumber: string }>;
  bespokeOrders: Array<{ id: string; orderRef: string }>;
};

type ChangeRequestRow = {
  id: string;
  message: string;
  createdAt: string;
  response: string | null;
  respondedAt: string | null;
  respondedBy: string | null;
  quotation: { id: string; quoteRef: string };
};

/** One request from the client, with the reply box while it is open. */
function ChangeRequestItem({ row, onReplied }: { row: ChangeRequestRow; onReplied: () => void }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const res = await fetch(`/api/quotations/${row.quotation.id}/change-requests/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: reply }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(j.error ?? "Could not send the reply");
        return;
      }
      toast.success("Reply sent to the client");
      onReplied();
    } finally {
      setSending(false);
    }
  }

  return (
    <li className={`border p-4 ${row.response ? "border-sand" : "border-warning/50 bg-warning-soft/30"}`}>
      <p className="font-body text-xs text-text-mid">
        {row.quotation.quoteRef} · {formatDate(row.createdAt)}
        {row.response ? "" : " · waiting for a reply"}
      </p>
      <p className="mt-1 whitespace-pre-line font-body text-sm text-ink">{row.message}</p>
      {row.response ? (
        <div className="mt-3 border-l-2 border-gold/60 pl-3">
          <p className="font-body text-xs text-text-mid">
            Replied by {row.respondedBy ?? "Prudent Gabriel"}
            {row.respondedAt ? ` · ${formatDate(row.respondedAt)}` : ""}
          </p>
          <p className="mt-1 whitespace-pre-line font-body text-sm text-ink">{row.response}</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            className="input-field min-h-[80px] w-full text-sm"
            placeholder="Your reply. It is emailed to her and shown on her quote page."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={4000}
          />
          <Button size="sm" loading={sending} disabled={reply.trim().length < 2} onClick={() => void send()}>
            Send reply
          </Button>
        </div>
      )}
    </li>
  );
}

function actorLabel(v: VersionRow): string {
  const u = v.revisedByUser ?? v.createdByUser;
  if (!u) return "—";
  return u.name?.trim() || u.email;
}

export function QuotationDetailClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [item, setItem] = useState<QuoteDetail | null>(null);
  const [history, setHistory] = useState<VersionRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/quotations/${id}`);
    if (!res.ok) {
      toast.error("Could not load quotation");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as {
      item: QuoteDetail;
      versionHistory: VersionRow[];
      changeRequests?: ChangeRequestRow[];
    };
    setItem(data.item);
    setHistory(data.versionHistory);
    setChangeRequests(data.changeRequests ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${id}/send`, { method: "POST" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) toast.error(j.error ?? "Send failed");
      else {
        toast.success("Quotation sent");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function revise() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${id}/revise`, { method: "POST" });
      const j = (await res.json()) as { error?: string; item?: { id: string } };
      if (!res.ok) {
        toast.error(j.error ?? "Revise failed");
        return;
      }
      toast.success("New version created. Make the changes, then send it.");
      if (j.item?.id) router.push(`/admin/quotations/${j.item.id}/edit`);
      else await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !item) {
    return <p className="mt-8 font-body text-sm text-text-mid">Loading…</p>;
  }

  const canRevise =
    item.status !== "SUPERSEDED" &&
    item.status !== "CONVERTED" &&
    item.status !== "DRAFT" &&
    item.invoices.length === 0 &&
    item.bespokeOrders.length === 0;
  /** Asked on this version and not yet answered by a newer one. */
  const openChangeRequests = changeRequests.filter((r) => r.quotation.id === item.id).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/quotations" className="font-body text-11px uppercase tracking-[0.1em] text-text-mid">
            ← Quotations
          </Link>
          <h1 className="mt-2 font-display text-2xl text-ink">{item.quoteRef}</h1>
          <p className="mt-1 font-body text-sm text-text-mid">
            {item.clientName} · {item.clientEmail}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="gold">{item.status}</Badge>
            <span className="font-body text-xs text-text-mid">v{item.version}</span>
            <span className="font-body text-sm text-ink">
              {formatInvoiceCurrency(item.total, asInvoiceCurrency(item.currency ?? "NGN"))}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/quotations/${item.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-sm border border-sand px-3 py-2 font-body text-11px uppercase tracking-[0.08em] text-ink hover:border-olive"
          >
            PDF
          </a>
          {item.status === "DRAFT" ? (
            <Link
              href={`/admin/quotations/${item.id}/edit`}
              className="inline-flex items-center rounded-sm border border-sand px-3 py-2 font-body text-11px uppercase tracking-[0.08em] text-ink hover:border-olive"
            >
              Edit
            </Link>
          ) : null}
          {item.status === "DRAFT" ? (
            <Button size="sm" disabled={busy} onClick={() => void send()}>
              {item.version > 1 ? "Send new version" : "Send"}
            </Button>
          ) : null}
          {canRevise ? (
            <Button
              size="sm"
              variant={openChangeRequests > 0 ? "primary" : "secondary"}
              disabled={busy}
              onClick={() => void revise()}
            >
              {openChangeRequests > 0 ? "Edit and send a new version" : "Revise quotation"}
            </Button>
          ) : null}
        </div>
      </div>

      {changeRequests.length > 0 ? (
        <section>
          <h2 className="font-display text-lg text-ink">Change requests from the client</h2>
          <p className="mt-1 font-body text-13px text-text-mid">
            Reply here to answer her, or revise the quotation and send the new version first, then reply so her
            email links to it.
          </p>
          <ul className="mt-4 space-y-3">
            {[...changeRequests].reverse().map((r) => (
              <ChangeRequestItem key={r.id} row={r} onReplied={() => void load()} />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-lg text-ink">Version history</h2>
        <p className="mt-1 font-body text-13px text-text-mid">
          Who revised, when, and the total delta between versions.
        </p>
        <div className="mt-4 overflow-x-auto border border-sand">
          <table className="w-full min-w-[720px] border-collapse font-body text-xs">
            <thead>
              <tr className="bg-[#37392d] text-left text-10px font-medium uppercase tracking-[0.1em] text-white">
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Δ</th>
                <th className="px-3 py-2">By</th>
                <th className="px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-sand">
                  <td className="px-3 py-2">v{h.version}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/quotations/${h.id}`} className="text-olive underline">
                      {h.quoteRef}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{h.status}</td>
                  <td className="px-3 py-2">
                    {formatInvoiceCurrency(h.total, asInvoiceCurrency(item.currency ?? "NGN"))}
                  </td>
                  <td className="px-3 py-2">
                    {h.version === 1
                      ? "—"
                      : `${h.totalDelta >= 0 ? "+" : "−"}${formatInvoiceCurrency(Math.abs(h.totalDelta), asInvoiceCurrency(item.currency ?? "NGN"))}`}
                  </td>
                  <td className="px-3 py-2">{actorLabel(h)}</td>
                  <td className="px-3 py-2">{formatDate(h.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {item.notes ? (
        <section>
          <h2 className="font-display text-lg text-ink">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap font-body text-sm text-text-mid">{item.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
