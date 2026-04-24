"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus, PaymentGateway, PaymentStatus } from "@prisma/client";
import toast from "react-hot-toast";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type ToolbarOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  adminNotes?: string | null;
  totalNGN: number;
  paymentGateway?: PaymentGateway | null;
};

const NEXT_OPTIONS: Partial<Record<OrderStatus, { value: OrderStatus; label: string }[]>> = {
  PENDING: [{ value: "CONFIRMED", label: "Confirm" }],
  CONFIRMED: [{ value: "PROCESSING", label: "Mark processing" }],
  PROCESSING: [{ value: "SHIPPED", label: "Mark shipped" }],
  SHIPPED: [{ value: "DELIVERED", label: "Mark delivered" }],
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
    if (refundOpen) {
      setRefundFull(true);
      setRefundAmount(String(Math.round(order.totalNGN)));
      setRefundReason("");
    }
  }, [refundOpen, order.totalNGN]);

  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [busy, setBusy] = useState(false);

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

  const options = NEXT_OPTIONS[order.status] ?? [];
  const canShip = order.status === "PROCESSING";

  return (
    <div className="rounded-sm border border-[#EBEBEA] bg-white p-6">
      <Dialog.Root open={refundOpen} onOpenChange={setRefundOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" />
          <Dialog.Content
            data-lenis-prevent
            className="fixed left-1/2 top-1/2 z-[101] max-h-[85vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-sm border border-[#EBEBEA] bg-white p-6 text-charcoal shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="font-display text-xl text-black">Issue Refund — #{order.orderNumber}</Dialog.Title>
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
                  className="mt-1 w-full border border-[#EBEBEA] bg-white px-3 py-2 text-charcoal"
                />
              ) : null}
              <label className="block text-xs uppercase text-[#A8A8A4]">
                Reason (required)
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-[#EBEBEA] bg-white px-3 py-2 text-sm text-charcoal"
                />
              </label>
            </div>
            <div className="mt-4 border border-[#FFF8E7] bg-[#FFF8E7] p-3 text-xs text-[#92660A]">
              This records the refund in Prudential Atelier. You must also issue the refund in your {gatewayLabel(order.paymentGateway)}{" "}
              dashboard separately.
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="border border-[#EBEBEA] px-4 py-2 text-xs text-olive">
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

      <p className="font-label text-xs uppercase text-[#A8A8A4]">Admin</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={busy}
            onClick={() => {
              if (o.value === "SHIPPED") {
                void patch({
                  status: "SHIPPED",
                  trackingNumber: tracking || null,
                  carrier: carrier || null,
                });
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
              className="border border-[#EBEBEA] bg-white px-2 py-1 text-xs text-charcoal"
            />
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Carrier"
              className="border border-[#EBEBEA] bg-white px-2 py-1 text-xs text-charcoal"
            />
          </div>
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
            className="border border-[#EBEBEA] px-3 py-2 text-xs text-olive hover:bg-[#FAFAFA]"
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
          className="mt-1 w-full border border-[#EBEBEA] bg-white px-3 py-2 text-sm text-charcoal"
          placeholder="Not visible to customer"
        />
      </label>
    </div>
  );
}
