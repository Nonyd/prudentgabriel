"use client";

import { useState } from "react";
import toast from "react-hot-toast";

type Row = {
  orderNumber: string;
  guestName: string | null;
  guestEmail: string | null;
  user: { name: string | null; email: string | null } | null;
  _count: { items: number };
  subtotal: number;
  shippingAmount: number;
  discount: number;
  total: number;
  currency: string;
  paymentGateway: string | null;
  paymentStatus: string;
  status: string;
  createdAt: string;
};

function escapeCell(v: unknown) {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export function AdminOrdersCsvExport({ query }: { query: string }) {
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders?${query}&limit=1000&format=csv`, { credentials: "same-origin" });
      if (!res.ok) {
        toast.error("Export failed");
        return;
      }
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("text/csv")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pa-orders-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV downloaded");
        return;
      }
      const j = (await res.json()) as { orders?: Row[] };
      const orders = j.orders ?? [];
      const csvRows = [
        [
          "Order #",
          "Customer",
          "Email",
          "Items",
          "Subtotal",
          "Shipping",
          "Discount",
          "Total",
          "Currency",
          "Gateway",
          "Payment",
          "Status",
          "Date",
        ],
        ...orders.map((o) => [
          o.orderNumber,
          o.user?.name ?? o.guestName ?? "Guest",
          o.user?.email ?? o.guestEmail ?? "",
          o._count.items,
          o.subtotal,
          o.shippingAmount,
          o.discount,
          o.total,
          o.currency,
          o.paymentGateway ?? "",
          o.paymentStatus,
          o.status,
          new Date(o.createdAt).toLocaleDateString("en-NG"),
        ]),
      ];
      const csv = csvRows.map((r) => r.map(escapeCell).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pa-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onExport()}
      className="rounded-sm border border-gold/30 px-4 py-2 text-xs text-gold hover:bg-gold/10 disabled:opacity-50"
    >
      {busy ? "Exporting…" : "Export CSV"}
    </button>
  );
}
