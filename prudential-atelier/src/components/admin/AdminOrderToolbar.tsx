"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus, PaymentGateway, PaymentStatus } from "@prisma/client";
import toast from "react-hot-toast";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AlertDialog } from "@/components/ui/AlertDialog";

type ToolbarOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  adminNotes?: string | null;
  totalNGN: number;
  paymentGateway?: PaymentGateway | null;
  shippingMethodKind?: string | null;
  fulfilmentKind?: string | null;
  carrier?: string | null;
  balance?: number;
  collectionCode?: string | null;
};

const NEXT_OPTIONS: Partial<Record<OrderStatus, { value: OrderStatus; label: string }[]>> = {
  PENDING: [{ value: "CONFIRMED", label: "Confirm" }],
  CONFIRMED: [
    { value: "PROCESSING", label: "Mark processing" },
    { value: "CUTTING", label: "Start cutting" },
  ],
  CUTTING: [{ value: "MAKING", label: "Start making" }],
  MAKING: [
    { value: "SHIPPED", label: "Mark shipped" },
    { value: "READY_FOR_COLLECTION", label: "Ready for collection" },
  ],
  PROCESSING: [
    { value: "SHIPPED", label: "Mark shipped" },
    { value: "READY_FOR_COLLECTION", label: "Ready for collection" },
  ],
  SHIPPED: [{ value: "DELIVERED", label: "Mark delivered" }],
  READY_FOR_COLLECTION: [{ value: "COLLECTED", label: "Mark collected" }],
};

function gatewayLabel(g: PaymentGateway | null | undefined) {
  if (!g) return "payment";
  if (g === "PAYSTACK") return "Paystack";
  if (g === "FLUTTERWAVE") return "Flutterwave";
  if (g === "STRIPE") return "Stripe";
  if (g === "MONNIFY") return "Monnify";
  return g;
}

export function AdminOrderToolbar({ order }: { order: ToolbarOrder }) {
  const router = useRouter();
  const [notes, setNotes] = useState(order.adminNotes ?? "");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundFull, setRefundFull] = useState(true);
  const [refundAmount, setRefundAmount] = useState(String(Math.round(order.totalNGN)));
  const [refundReason, setRefundReason] = useState("");

  useEffect(() => {
    setNotes(order.adminNotes ?? "");
  }, [order.adminNotes]);

  useEffect(() => {
    setCarrier(order.carrier ?? "");
  }, [order.carrier]);

  useEffect(() => {
    if (refundOpen) {
      setRefundFull(true);
      setRefundAmount(String(Math.round(order.totalNGN)));
      setRefundReason("");
    }
  }, [refundOpen, order.totalNGN]);

  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [collectionCode, setCollectionCode] = useState(order.collectionCode ?? "");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success("Order updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const submitRefund = async () => {
    const reason = refundReason.trim();
    if (!reason) {
      toast.error("Please enter a reason");
      return;
    }
    const amt = Number(refundAmount);
    if (!refundFull && (!Number.isFinite(amt) || amt <= 0)) {
      toast.error("Enter a valid partial amount");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordRefund: {
            full: refundFull,
            amountNGN: refundFull ? order.totalNGN : amt,
            reason,
          },
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success("Refund recorded");
      setRefundOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteOrder = async () => {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, { method: "DELETE", credentials: "include" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.success("Order deleted");
      setDeleteOpen(false);
      router.push("/admin/orders");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setDeleteBusy(false);
    }
  };

  const isPickup = order.shippingMethodKind === "PICKUP";
  const isMto = order.fulfilmentKind === "MADE_TO_ORDER" || order.fulfilmentKind === "MIXED";
  const unpaid = order.paymentStatus !== "PAID";
  const options = (NEXT_OPTIONS[order.status] ?? []).filter((o) => {
    if (unpaid && o.value !== "CANCELLED") return false;
    if (isPickup && o.value === "SHIPPED") return false;
    if (!isPickup && o.value === "READY_FOR_COLLECTION") return false;
    if (isMto && o.value === "PROCESSING") return false;
    if (!isMto && (o.value === "CUTTING" || o.value === "MAKING")) return false;
    return true;
  });
  const canShip = (order.status === "PROCESSING" || order.status === "MAKING") && !isPickup && !unpaid;
  const canCollect = order.status === "READY_FOR_COLLECTION" && !unpaid;
  const outstanding = (order.balance ?? 0) > 0.01;

  return (
    <div className="rounded-sm border border-sand bg-canvas p-6">
      <Dialog.Root open={refundOpen} onOpenChange={setRefundOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" />
          <Dialog.Content
            data-lenis-prevent
            className="fixed left-1/2 top-1/2 z-[101] max-h-[85vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-sm border border-sand bg-canvas p-6 text-charcoal shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="font-display text-xl text-ink">Issue Refund — #{order.orderNumber}</Dialog.Title>
              <Dialog.Close className="rounded-sm p-1 text-[#A8A8A4] hover:text-charcoal" aria-label="Close refund dialog">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-2 text-sm text-[#6B6B68]">
              Refunds are processed manually in your payment gateway dashboard.
            </Dialog.Description>
            <div className="mt-4 space-y-3 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" checked={refundFull} onChange={() => setRefundFull(true)} />
                Full Refund (₦{Math.round(order.totalNGN).toLocaleString("en-NG")})
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" checked={!refundFull} onChange={() => setRefundFull(false)} />
                Partial Refund
              </label>
              {!refundFull ? (
                <input
                  type="number"
                  min={1}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="mt-1 w-full border border-sand bg-canvas px-3 py-2 text-charcoal"
                />
              ) : null}
              <label className="block text-xs uppercase text-[#A8A8A4]">
                Reason (required)
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-sand bg-canvas px-3 py-2 text-sm text-charcoal"
                />
              </label>
            </div>
            <div className="mt-4 border border-[#FFF8E7] bg-[#FFF8E7] p-3 text-xs text-[#92660A]">
              This records the refund in Prudential Atelier. You must also issue the refund in your {gatewayLabel(order.paymentGateway)}{" "}
              dashboard separately.
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="border border-sand px-4 py-2 text-xs text-olive">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitRefund()}
                className="bg-olive px-4 py-2 text-xs text-white hover:bg-olive-hover disabled:opacity-50"
              >
                Record Refund
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this order?"
        description={`Permanently remove order ${order.orderNumber} and its line items from the database. This cannot be undone.`}
        variant="danger"
        confirmLabel="Delete order"
        onConfirm={confirmDeleteOrder}
        loading={deleteBusy}
      />

      <p className="font-label text-xs uppercase text-[#A8A8A4]">Admin</p>
      {unpaid ? (
        <p className="mt-2 font-body text-sm text-[#C45E0A]">
          Payment is not approved yet. Use Proof of payment above before cutting or shipping.
        </p>
      ) : null}
      {outstanding ? (
        <p className="mt-2 font-body text-sm text-[#92660A]">Balance outstanding — cannot ship or release for collection.</p>
      ) : null}
      {order.collectionCode ? (
        <p className="mt-2 font-body text-sm text-ink">Collection code: {order.collectionCode}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={
              busy ||
              (outstanding &&
                (o.value === "SHIPPED" || o.value === "READY_FOR_COLLECTION" || o.value === "COLLECTED"))
            }
            onClick={() => {
              if (o.value === "SHIPPED") {
                void patch({
                  status: "SHIPPED",
                  trackingNumber: tracking || null,
                  carrier: carrier || null,
                });
              } else if (o.value === "COLLECTED") {
                void patch({ status: "COLLECTED", collectionCode });
              } else {
                void patch({ status: o.value });
              }
            }}
            className="bg-olive px-3 py-2 text-xs text-white hover:bg-olive-hover disabled:opacity-50"
          >
            {o.label}
          </button>
        ))}
        {canShip ? (
          <div className="flex flex-wrap gap-2">
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Tracking #"
              className="border border-sand bg-canvas px-2 py-1 text-xs text-charcoal"
            />
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Carrier"
              className="border border-sand bg-canvas px-2 py-1 text-xs text-charcoal"
            />
          </div>
        ) : null}
        {canCollect ? (
          <input
            value={collectionCode}
            onChange={(e) => setCollectionCode(e.target.value)}
            placeholder="Collection code"
            className="border border-sand bg-canvas px-2 py-1 text-xs text-charcoal"
          />
        ) : null}
        <button
          type="button"
          disabled={busy}
          className="rounded-sm border border-red-500/40 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
          onClick={() => void patch({ status: "CANCELLED" })}
        >
          Cancel
        </button>
        {order.paymentStatus === "PAID" ? (
          <button
            type="button"
            disabled={busy}
            className="border border-sand px-3 py-2 text-xs text-olive hover:bg-[#FAFAFA]"
            onClick={() => setRefundOpen(true)}
          >
            Issue Refund
          </button>
        ) : null}
      </div>
      <label className="mt-4 block text-xs text-[#6B6B68]">
        Internal notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (order.adminNotes ?? "")) void patch({ adminNotes: notes });
          }}
          rows={3}
          className="mt-1 w-full border border-sand bg-canvas px-3 py-2 text-sm text-charcoal"
          placeholder="Not visible to customer"
        />
      </label>
      <div className="mt-6 border-t border-sand pt-4">
        <p className="font-label text-xs uppercase text-red-600/90">Danger zone</p>
        <button
          type="button"
          disabled={busy || deleteBusy}
          className="mt-2 rounded-sm border border-red-500/50 px-3 py-2 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-50"
          onClick={() => setDeleteOpen(true)}
        >
          Delete order permanently
        </button>
      </div>
    </div>
  );
}
