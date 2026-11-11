"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

function isPdfUrl(url: string) {
  return /\.pdf(\?|#|$)/i.test(url);
}

/** The client's transfer receipt for a quoted shipping fee: check it, then approve or reject. */
export function AdminShippingReceipt({
  paymentId,
  orderNumber,
  amountNGN,
  receiptSrc,
  submittedAt,
}: {
  paymentId: string;
  orderNumber: string;
  amountNGN: number;
  receiptSrc: string;
  submittedAt: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [arrived, setArrived] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const amountLabel = `₦${Math.round(amountNGN).toLocaleString("en-NG")}`;

  async function approve() {
    setBusy(true);
    try {
      const raw = arrived.trim();
      const arrivedAmount = raw ? Number(raw) : undefined;
      const res = await fetch(`/api/admin/payments/payment-${paymentId}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arrivedAmount != null && Number.isFinite(arrivedAmount) ? { arrivedAmount } : {}),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not approve");
      toast.success("Shipping payment approved. The client has been emailed.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      toast.error("Enter a reason so the client knows what to send next");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/payments/payment-${paymentId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not reject");
      toast.success("Receipt rejected. The client will see your reason on the pay page.");
      setRejectOpen(false);
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reject");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-sm border-2 border-[#C45E0A]/40 bg-warning-soft p-6">
      <p className="font-sans text-11px font-semibold uppercase tracking-[0.14em] text-warning">Shipping · bank transfer</p>
      <h2 className="mt-1 font-display text-2xl text-choc">Shipping receipt to approve</h2>
      <p className="mt-2 font-body text-base leading-6 text-charcoal">
        Expected {amountLabel} for shipping on {orderNumber}. Sent {new Date(submittedAt).toLocaleString("en-GB")}.
        Check it against the bank, then approve or reject.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="overflow-hidden rounded-sm border border-sand bg-white">
          {isPdfUrl(receiptSrc) ? (
            <iframe title="Shipping receipt" src={receiptSrc} className="h-[420px] w-full" />
          ) : (
            <a href={receiptSrc} target="_blank" rel="noreferrer" className="block">
              <Image
                src={receiptSrc}
                alt="Shipping receipt"
                width={900}
                height={1200}
                className="max-h-[420px] w-full object-contain"
                unoptimized
              />
            </a>
          )}
        </div>
        <div className="space-y-3">
          <a
            href={receiptSrc}
            target="_blank"
            rel="noreferrer"
            className="inline-block font-sans text-sm uppercase tracking-wider text-choc underline underline-offset-4"
          >
            Open receipt in a new tab
          </a>
          <label className="block font-body text-sm text-charcoal">
            Amount that arrived
            <input
              type="text"
              inputMode="decimal"
              value={arrived}
              onChange={(e) => setArrived(e.target.value)}
              placeholder={String(Math.round(amountNGN))}
              className="mt-1 w-full border border-sand bg-white px-3 py-2.5 font-body text-base text-choc"
            />
          </label>
          <p className="font-body text-sm text-charcoal-mid">Leave blank if the full amount landed.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void approve()}
            className="w-full bg-[#1B5E20] px-4 py-3 font-sans text-sm uppercase tracking-wider text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Approve payment"}
          </button>
          {rejectOpen ? (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Why it can't be confirmed (the client sees this)"
                className="w-full border border-sand bg-white px-3 py-2 font-body text-sm text-choc"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void reject()}
                className="w-full border border-error/30 bg-white px-4 py-3 font-sans text-sm uppercase tracking-wider text-error disabled:opacity-50"
              >
                Reject with this reason
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejectOpen(true)}
              className="w-full border border-error/30 px-4 py-3 font-sans text-sm uppercase tracking-wider text-error disabled:opacity-50"
            >
              Reject receipt
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
