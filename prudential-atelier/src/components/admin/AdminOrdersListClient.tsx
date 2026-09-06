"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderStatus, PaymentGateway, PaymentStatus } from "@prisma/client";
import toast from "react-hot-toast";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { orderWhatsAppUrl } from "@/lib/shipping/whatsapp";

export type AdminOrderListRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  itemCount: number;
  firstItemName: string;
  total: number;
  paymentGateway: PaymentGateway | null;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
};

function gatewayBadgeClass(g: PaymentGateway | null): string {
  switch (g) {
    case "PAYSTACK":
      return "bg-[#E8F5E9] text-[#1B5E20]";
    case "FLUTTERWAVE":
      return "bg-[#E8F0FF] text-[#1A3FAD]";
    case "STRIPE":
      return "bg-[#F0E8FF] text-[#6B3FAD]";
    case "MONNIFY":
      return "bg-[#FFF3E0] text-[#C45E0A]";
    case "BANK_TRANSFER":
      return "bg-[#F5F0E8] text-[#442913]";
    default:
      return "bg-[#FAFAFA] text-[#A8A8A4]";
  }
}

function GatewayPill({ gateway }: { gateway: PaymentGateway | null }) {
  return (
    <span className={`inline-block px-2 py-0.5 font-body text-[9px] font-medium uppercase ${gatewayBadgeClass(gateway)}`}>
      {gateway ?? "—"}
    </span>
  );
}

type DeleteState = { mode: "single"; id: string; orderNumber: string } | { mode: "bulk"; ids: string[] } | null;

export function AdminOrdersListClient({ orders }: { orders: AdminOrderListRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [busy, setBusy] = useState(false);

  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(orders.map((o) => o.id)));
  };

  const runDelete = async () => {
    if (!deleteState) return;
    setBusy(true);
    try {
      if (deleteState.mode === "single") {
        const res = await fetch(`/api/admin/orders/${deleteState.id}`, { method: "DELETE", credentials: "include" });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "Delete failed");
          return;
        }
        toast.success(`Order ${deleteState.orderNumber} deleted`);
      } else {
        const res = await fetch("/api/admin/orders/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ids: deleteState.ids }),
        });
        const data = (await res.json()) as { error?: string; deleted?: number };
        if (!res.ok) {
          toast.error(data.error ?? "Delete failed");
          return;
        }
        toast.success(`${data.deleted ?? deleteState.ids.length} order(s) deleted`);
      }
      setSelected(new Set());
      setDeleteState(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const bulkCancel = async () => {
    if (selected.size === 0) return;
    const targets = orders.filter(
      (o) =>
        selected.has(o.id) &&
        o.status !== "CANCELLED" &&
        o.status !== "REFUNDED" &&
        (o.status === "PENDING" || o.status === "CONFIRMED" || o.status === "PROCESSING"),
    );
    if (targets.length === 0) {
      toast.error("No cancellable orders in selection");
      return;
    }
    setBusy(true);
    try {
      const results = await Promise.all(
        targets.map((o) =>
          fetch(`/api/admin/orders/${o.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: "CANCELLED" }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) {
        toast.error("Some orders could not be cancelled");
        return;
      }
      toast.success(`${targets.length} order(s) marked cancelled`);
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const deleteDescription = useMemo(() => {
    if (deleteState?.mode === "single") {
      return `Permanently delete order ${deleteState.orderNumber}? Line items and payment references will be removed. This cannot be undone.`;
    }
    if (deleteState?.mode === "bulk") {
      return `Permanently delete ${deleteState.ids.length} order(s)? This cannot be undone.`;
    }
    return "";
  }, [deleteState]);

  return (
    <>
      <AlertDialog
        open={deleteState !== null}
        onOpenChange={(o) => !o && setDeleteState(null)}
        title={deleteState?.mode === "bulk" ? "Delete orders" : "Delete order"}
        description={deleteDescription}
        variant="danger"
        confirmLabel={deleteState?.mode === "bulk" ? "Delete selected" : "Delete order"}
        onConfirm={runDelete}
        loading={busy}
      />

      {selected.size > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-sm border border-olive bg-olive p-3 text-sm text-white shadow-md">
          <span className="font-medium">{selected.size} selected</span>
          <button
            type="button"
            disabled={busy}
            className="border border-white/40 px-3 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
            onClick={() => void bulkCancel()}
          >
            Mark cancelled
          </button>
          <button
            type="button"
            disabled={busy}
            className="border border-white/40 bg-red-900/40 px-3 py-1 text-xs hover:bg-red-900/60 disabled:opacity-50"
            onClick={() => setDeleteState({ mode: "bulk", ids: Array.from(selected) })}
          >
            Delete selected
          </button>
        </div>
      ) : null}

      <div className="-mx-4 overflow-x-auto glass-opaque px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[700px] text-left text-sm text-charcoal">
          <thead className="border-b border-sand text-[11px] uppercase text-[#A8A8A4]">
            <tr>
              <th className="w-10 p-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all on page" />
              </th>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="hidden p-3 md:table-cell">Items</th>
              <th className="p-3">Total</th>
              <th className="hidden p-3 lg:table-cell">Gateway</th>
              <th className="hidden p-3 md:table-cell">Payment</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const wa = orderWhatsAppUrl(o.customerPhone, o.orderNumber);
              return (
              <tr
                key={o.id}
                className={
                  o.paymentStatus === "PAID" && o.status === "CANCELLED"
                    ? "border-b border-[#F5F5F3] bg-[#F8F1E8] hover:bg-[#F3E6D8]"
                    : o.paymentGateway === "BANK_TRANSFER" && o.paymentStatus === "PENDING"
                      ? "border-b border-[#F5F5F3] bg-[#FFF8F0] hover:bg-[#FFF1E4]"
                      : "border-b border-[#F5F5F3] hover:bg-[#FAFAFA]"
                }
              >
                <td className="p-3">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} aria-label={`Select ${o.orderNumber}`} />
                </td>
                <td className="p-3 font-body text-[11px] font-medium text-olive">{o.orderNumber}</td>
                <td className="p-3">
                  <div className="font-medium text-ink">{o.customerName}</div>
                  <div className="text-xs text-[#A8A8A4]">{o.customerEmail}</div>
                </td>
                <td className="hidden p-3 text-xs text-[#6B6B68] md:table-cell">
                  {o.itemCount} · {o.firstItemName}
                </td>
                <td className="p-3 font-body text-[13px] text-ink">₦{Math.round(o.total).toLocaleString("en-NG")}</td>
                <td className="hidden p-3 text-xs lg:table-cell">
                  <GatewayPill gateway={o.paymentGateway} />
                </td>
                <td className="hidden p-3 text-xs md:table-cell">
                  {o.paymentGateway === "BANK_TRANSFER" && o.paymentStatus === "PENDING"
                    ? "Awaiting proof"
                    : o.paymentStatus}
                </td>
                <td className="p-3 text-xs">
                  {o.paymentStatus === "PAID" && o.status === "CANCELLED" ? (
                    <span className="font-medium text-choc">Refund required</span>
                  ) : (
                    o.status
                  )}
                </td>
                <td className="p-3 text-xs text-[#A8A8A4]">{new Date(o.createdAt).toLocaleDateString("en-NG")}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-body text-[11px] text-olive hover:underline">
                      {o.paymentGateway === "BANK_TRANSFER" && o.paymentStatus === "PENDING"
                        ? "Review proof"
                        : "View"}
                    </Link>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="font-body text-[11px] text-olive hover:underline"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="font-body text-[11px] text-red-600 hover:underline"
                      onClick={() => setDeleteState({ mode: "single", id: o.id, orderNumber: o.orderNumber })}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
