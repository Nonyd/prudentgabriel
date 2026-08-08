"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { QuoteStatus } from "@prisma/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate, formatPrice } from "@/lib/utils";

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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/quotations/${id}`);
    if (!res.ok) {
      toast.error("Could not load quotation");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { item: QuoteDetail; versionHistory: VersionRow[] };
    setItem(data.item);
    setHistory(data.versionHistory);
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
      toast.success("New version created");
      if (j.item?.id) router.push(`/admin/quotations/${j.item.id}`);
      else await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !item) {
    return <p className="mt-8 font-body text-sm text-[#6B6B68]">Loading…</p>;
  }

  const canRevise =
    item.status !== "SUPERSEDED" &&
    item.status !== "CONVERTED" &&
    item.status !== "DRAFT" &&
    item.invoices.length === 0 &&
    item.bespokeOrders.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/quotations" className="font-body text-[11px] uppercase tracking-[0.1em] text-[#6B6B68]">
            ← Quotations
          </Link>
          <h1 className="mt-2 font-display text-2xl text-ink">{item.quoteRef}</h1>
          <p className="mt-1 font-body text-sm text-[#6B6B68]">
            {item.clientName} · {item.clientEmail}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="gold">{item.status}</Badge>
            <span className="font-body text-xs text-[#6B6B68]">v{item.version}</span>
            <span className="font-body text-sm text-ink">{formatPrice(item.total, "NGN")}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/quotations/${item.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-sm border border-sand px-3 py-2 font-body text-[11px] uppercase tracking-[0.08em] text-ink hover:border-olive"
          >
            PDF
          </a>
          {item.status === "DRAFT" ? (
            <Button size="sm" disabled={busy} onClick={() => void send()}>
              Send
            </Button>
          ) : null}
          {canRevise ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void revise()}>
              Revise quotation
            </Button>
          ) : null}
        </div>
      </div>

      <section>
        <h2 className="font-display text-lg text-ink">Version history</h2>
        <p className="mt-1 font-body text-[13px] text-[#6B6B68]">
          Who revised, when, and the total delta between versions.
        </p>
        <div className="mt-4 overflow-x-auto border border-sand">
          <table className="w-full min-w-[720px] border-collapse font-body text-xs">
            <thead>
              <tr className="bg-[#37392d] text-left text-[10px] font-medium uppercase tracking-[0.1em] text-white">
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
                  <td className="px-3 py-2">{formatPrice(h.total, "NGN")}</td>
                  <td className="px-3 py-2">
                    {h.version === 1
                      ? "—"
                      : `${h.totalDelta >= 0 ? "+" : ""}${formatPrice(h.totalDelta, "NGN")}`}
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
          <p className="mt-2 whitespace-pre-wrap font-body text-sm text-[#6B6B68]">{item.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
