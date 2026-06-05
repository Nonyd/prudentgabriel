"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Invoice, InvoiceStatus } from "@prisma/client";
import toast from "react-hot-toast";
import { formatInvoiceCurrency } from "@/lib/invoice";
import type { InvoiceCurrency } from "@/types/invoice";

type Row = Invoice & {
  bespokeRequest: { id: string; requestNumber: string; occasion: string } | null;
  bespokeOrder: { id: string; orderRef: string } | null;
};

function asCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP") return c;
  return "NGN";
}

const TABS: { id: string; label: string; status?: InvoiceStatus | "all" }[] = [
  { id: "all", label: "All", status: "all" },
  { id: "DRAFT", label: "Draft", status: "DRAFT" },
  { id: "SENT", label: "Sent", status: "SENT" },
  { id: "PARTIALLY_PAID", label: "Partially paid", status: "PARTIALLY_PAID" },
  { id: "PAID", label: "Paid", status: "PAID" },
  { id: "OVERDUE", label: "Overdue", status: "OVERDUE" },
  { id: "CANCELLED", label: "Cancelled", status: "CANCELLED" },
];

export function InvoicesClient() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<{
    totalInvoiced: number;
    outstanding: number;
    overdue: number;
    paidThisMonth: number;
  } | null>(null);

  const statusFilter = useMemo(() => TABS.find((t) => t.id === tab)?.status ?? "all", [tab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (search.trim()) qs.set("search", search.trim());
      if (currency !== "all") qs.set("currency", currency);
      qs.set("page", String(page));
      qs.set("limit", "20");
      const res = await fetch(`/api/admin/invoices?${qs}`);
      if (!res.ok) throw new Error("Failed to load");
      const j = (await res.json()) as {
        invoices: Row[];
        total: number;
        totalPages: number;
        stats?: typeof stats;
      };
      setRows(j.invoices);
      setTotal(j.total);
      setTotalPages(j.totalPages);
      if (j.stats) setStats(j.stats);
    } catch {
      toast.error("Could not load invoices");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, currency, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/invoices?stats=1&limit=1&page=1");
      if (!res.ok) return;
      const j = (await res.json()) as { stats?: typeof stats };
      if (j.stats) setStats(j.stats);
    })();
  }, []);

  const send = async (id: string) => {
    if (!confirm("Send invoice email to the client?")) return;
    const res = await fetch(`/api/admin/invoices/${id}/send`, { method: "POST" });
    if (!res.ok) {
      toast.error("Send failed");
      return;
    }
    toast.success("Invoice sent");
    void load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this draft invoice?")) return;
    const res = await fetch(`/api/admin/invoices/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Deleted");
    void load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Invoices</h1>
          <p className="mt-1 font-body text-[13px] text-[#6B6B68]">Prudential Atelier</p>
        </div>
        <Link
          href="/admin/invoices/new"
          className="inline-flex h-10 items-center bg-[#37392d] px-5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white"
        >
          + Create invoice
        </Link>
      </div>

      {stats ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total invoiced", value: `₦${stats.totalInvoiced.toLocaleString("en-NG")}` },
            { label: "Outstanding", value: String(stats.outstanding) },
            { label: "Overdue", value: String(stats.overdue) },
            { label: "Paid this month", value: String(stats.paidThisMonth) },
          ].map((c) => (
            <div key={c.label} className="border border-[#EBEBEA] bg-canvas p-4">
              <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-[#A8A8A4]">{c.label}</p>
              <p className="mt-2 font-body text-lg text-ink">{c.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2 border-b border-[#EBEBEA] pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setPage(1);
            }}
            className={`rounded-sm px-3 py-1.5 font-body text-xs ${
              tab === t.id ? "bg-[#37392d] text-white" : "text-charcoal hover:bg-[#F2F2F0]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          className="min-w-[200px] flex-1 border border-[#EBEBEA] px-3 py-2 font-body text-sm"
          placeholder="Search name, email, invoice #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void load()}
        />
        <select
          className="border border-[#EBEBEA] px-3 py-2 font-body text-sm"
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All currencies</option>
          <option value="NGN">NGN</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
        </select>
        <button
          type="button"
          className="border border-[#EBEBEA] px-4 py-2 font-body text-xs uppercase text-olive"
          onClick={() => void load()}
        >
          Search
        </button>
      </div>

      <div className="mt-6 overflow-x-auto border border-[#EBEBEA]">
        <table className="w-full min-w-[900px] border-collapse font-body text-xs">
          <thead>
            <tr className="bg-[#37392d] text-left text-[10px] font-medium uppercase tracking-[0.1em] text-white">
              <th className="px-3 py-2">Invoice #</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Balance</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Sent</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-[#6B6B68]">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-[#6B6B68]">
                  No invoices yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const cur = asCurrency(r.currency);
                const overdue = r.dueDate && new Date(r.dueDate) < new Date() && r.balanceDue > 0;
                return (
                  <tr key={r.id} className="border-t border-[#EBEBEA]">
                    <td className="px-3 py-2 font-mono text-[11px] text-olive">{r.invoiceNumber}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.clientName}</div>
                      <div className="text-[#6B6B68]">{r.clientEmail}</div>
                    </td>
                    <td className="px-3 py-2">
                      {r.bespokeOrder ? (
                        <Link className="text-olive underline" href={`/admin/bespoke/${r.bespokeOrder.id}`}>
                          {r.bespokeOrder.orderRef}
                        </Link>
                      ) : r.bespokeRequest ? (
                        <Link
                          className="text-olive underline"
                          href={`/admin/bespoke/intake/${r.bespokeRequest.id}`}
                        >
                          {r.bespokeRequest.requestNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.currency} {formatInvoiceCurrency(r.total, cur)}
                    </td>
                    <td className={`px-3 py-2 ${r.balanceDue > 0 ? "text-red-800" : "text-ink"}`}>
                      {formatInvoiceCurrency(r.balanceDue, cur)}
                    </td>
                    <td className="px-3 py-2">{r.status.replace(/_/g, " ")}</td>
                    <td className={`px-3 py-2 ${overdue ? "text-red-800 font-medium" : ""}`}>
                      {r.dueDate ? new Date(r.dueDate).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-3 py-2">{r.sentAt ? "✓" : "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Link href={`/admin/invoices/${r.id}`} className="text-olive underline">
                          View
                        </Link>
                        <button type="button" className="text-olive underline" onClick={() => void send(r.id)}>
                          Send
                        </button>
                        <a className="text-olive underline" href={`/api/admin/invoices/${r.id}/pdf`} target="_blank" rel="noreferrer">
                          PDF
                        </a>
                        {r.status === "DRAFT" ? (
                          <button type="button" className="text-red-700 underline" onClick={() => void del(r.id)}>
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between font-body text-xs text-[#6B6B68]">
          <span>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              className="border border-[#EBEBEA] px-3 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              className="border border-[#EBEBEA] px-3 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
