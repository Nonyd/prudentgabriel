"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { QuoteStatus } from "@prisma/client";
import { BulkSelectTable, type BulkColumn } from "@/components/ui/BulkSelectTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatPrice } from "@/lib/utils";
import { InvoicesQuotationsNav } from "@/components/admin/InvoicesQuotationsNav";

type QuoteRow = {
  id: string;
  quoteRef: string;
  clientName: string;
  clientEmail: string;
  total: number;
  status: QuoteStatus;
  version?: number;
  createdAt: string;
};

function quoteBadge(status: QuoteStatus) {
  const map: Record<QuoteStatus, { variant: "grey" | "gold" | "success" | "wine" | "outline-gold"; label: string }> = {
    DRAFT: { variant: "grey", label: "Draft" },
    SENT: { variant: "gold", label: "Sent" },
    APPROVED: { variant: "success", label: "Approved" },
    REJECTED: { variant: "wine", label: "Rejected" },
    CONVERTED: { variant: "outline-gold", label: "Converted" },
    SUPERSEDED: { variant: "grey", label: "Superseded" },
  };
  const cfg = map[status] ?? { variant: "grey" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function QuotationsListClient() {
  const [items, setItems] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/quotations?${params}`);
    if (!res.ok) {
      toast.error("Failed to load quotations");
      return;
    }
    const data = (await res.json()) as { items: QuoteRow[] };
    setItems(data.items);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 300);
    return () => clearTimeout(t);
  }, [refresh]);

  const handleBulkDelete = async (ids: string[]) => {
    const results = await Promise.all(
      ids.map((id) => fetch(`/api/quotations/${id}`, { method: "DELETE" })),
    );
    if (results.some((r) => !r.ok)) toast.error("Some deletions failed");
    else toast.success(`Deleted ${ids.length} quotation(s)`);
    await refresh();
  };

  const sendQuote = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/quotations/${id}/send`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send quotation");
        return;
      }
      toast.success("Quotation sent to client");
      await refresh();
    },
    [refresh],
  );

  const convertQuote = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/quotations/${id}/convert`, { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        order?: { id: string; orderRef: string };
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to convert quotation");
        return;
      }
      toast.success(`Converted to order ${data.order?.orderRef ?? ""}`);
      await refresh();
      if (data.order?.id) {
        window.location.href = `/admin/bespoke/${data.order.id}`;
      }
    },
    [refresh],
  );

  const columns: BulkColumn<QuoteRow>[] = useMemo(
    () => [
      {
        key: "ref",
        header: "Quote Ref",
        cell: (row) => (
          <Link href={`/admin/quotations/${row.id}`} className="font-sans text-sm font-medium text-nut underline">
            {row.quoteRef}
          </Link>
        ),
      },
      {
        key: "client",
        header: "Client",
        cell: (row) => (
          <div>
            <p className="font-sans text-sm">{row.clientName}</p>
            <p className="font-sans text-xs text-text-light">{row.clientEmail}</p>
          </div>
        ),
      },
      {
        key: "total",
        header: "Total",
        cell: (row) => (
          <span className="font-sans text-sm">{formatPrice(row.total, "NGN")}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => quoteBadge(row.status),
      },
      {
        key: "created",
        header: "Created",
        cell: (row) => (
          <span className="font-sans text-xs text-text-mid">{formatDate(row.createdAt)}</span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        cell: (row) => {
          if (row.status === "DRAFT") {
            return (
              <Button size="sm" variant="secondary" onClick={() => void sendQuote(row.id)}>
                Send
              </Button>
            );
          }
          if (row.status === "SENT" || row.status === "APPROVED") {
            return (
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/quotations/${row.id}`}>
                  <Button size="sm" variant="secondary">
                    Open
                  </Button>
                </Link>
                {row.status === "APPROVED" ? (
                  <Button size="sm" onClick={() => void convertQuote(row.id)}>
                    Convert to Order
                  </Button>
                ) : null}
              </div>
            );
          }
          return (
            <Link href={`/admin/quotations/${row.id}`} className="font-sans text-xs text-olive underline">
              View
            </Link>
          );
        },
      },
    ],
    [convertQuote, sendQuote],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Finance</p>
          <h1 className="font-display text-2xl text-ink">Quotations &amp; Invoices</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">
            Create and send client quotations for bespoke work
          </p>
          <InvoicesQuotationsNav />
        </div>
        <Link href="/admin/invoices/quotations/new">
          <Button>New Quotation</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search ref or client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded border border-sand bg-bg-card px-3 py-2 font-sans text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-sand bg-bg-card px-3 py-2 font-sans text-sm"
        >
          <option value="all">All statuses</option>
          {(["DRAFT", "SENT", "APPROVED", "REJECTED", "CONVERTED", "SUPERSEDED"] as QuoteStatus[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-text-mid">Loading quotations…</p>
      ) : (
        <BulkSelectTable
          columns={columns}
          data={items}
          onBulkDelete={handleBulkDelete}
          emptyMessage="No quotations yet."
        />
      )}
    </div>
  );
}
