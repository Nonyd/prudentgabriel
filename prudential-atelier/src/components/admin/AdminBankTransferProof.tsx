"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { adminReceiptSrc } from "@/lib/media/receipt-src";

function isPdfUrl(url: string) {
  return /\.pdf(\?|#|$)/i.test(url);
}

export function AdminBankTransferProof({
  orderId,
  orderNumber,
  paymentStatus,
  paymentGateway,
  receiptUrl,
  amountNGN,
  currency,
}: {
  orderId: string;
  orderNumber: string;
  paymentStatus: string;
  paymentGateway: string | null;
  receiptUrl: string | null;
  amountNGN: number;
  currency: string;
}) {
  const router = useRouter();
  const [arrived, setArrived] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [lightbox, setLightbox] = useState(false);

  const proofSrc = adminReceiptSrc(receiptUrl);

  if (paymentGateway !== "BANK_TRANSFER") return null;

  const pending = paymentStatus === "PENDING";
  const paid = paymentStatus === "PAID";
  const failed = paymentStatus === "FAILED" || paymentStatus === "REJECTED";
  const amountLabel =
    currency && currency !== "NGN"
      ? `${currency} ${Math.round(amountNGN).toLocaleString("en-NG")}`
      : `₦${Math.round(amountNGN).toLocaleString("en-NG")}`;

  async function confirm() {
    setBusy(true);
    try {
      const raw = arrived.trim();
      const arrivedAmount = raw ? Number(raw) : undefined;
      const res = await fetch(`/api/admin/payments/order-${orderId}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arrivedAmount != null && Number.isFinite(arrivedAmount) ? { arrivedAmount } : {}),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not approve payment");
      toast.success("Bank transfer approved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve payment");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      toast.error("Enter a reason so the customer knows what to send next");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/payments/order-${orderId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not reject payment");
      toast.success("Receipt rejected");
      setRejectOpen(false);
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reject payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-sm border-2 border-[#C45E0A]/40 bg-[#FFF8F0] p-6">
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C45E0A]">
        Bank transfer
      </p>
      <h2 className="mt-1 font-display text-2xl text-choc">Proof of payment</h2>
      <p className="mt-2 font-body text-base leading-6 text-charcoal">
        Expected {amountLabel} for {orderNumber}. Open the receipt, check it against the bank, then approve or
        reject.
      </p>

      {pending && !receiptUrl ? (
        <p className="mt-4 border border-[#E8D5B0] bg-white px-4 py-3 font-body text-base text-[#92660A]">
          The customer has not uploaded a receipt yet. This order stays unpaid until they do.
        </p>
      ) : null}

      {failed ? (
        <p className="mt-4 border border-red-200 bg-white px-4 py-3 font-body text-base text-red-800">
          This receipt was rejected. The customer needs to pay again or upload a new proof.
        </p>
      ) : null}

      {paid ? (
        <p className="mt-4 border border-[#1B5E20]/20 bg-white px-4 py-3 font-body text-base text-[#1B5E20]">
          Payment is approved. Keep the receipt on file below.
        </p>
      ) : null}

      {receiptUrl ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="overflow-hidden rounded-sm border border-sand bg-white">
            {isPdfUrl(proofSrc) ? (
              <iframe title="Payment receipt" src={proofSrc} className="h-[420px] w-full" />
            ) : (
              <button
                type="button"
                className="block w-full"
                onClick={() => setLightbox(true)}
                aria-label="Enlarge receipt"
              >
                <Image
                  src={proofSrc}
                  alt="Payment receipt"
                  width={900}
                  height={1200}
                  className="max-h-[420px] w-full object-contain"
                  unoptimized
                />
              </button>
            )}
          </div>
          <div className="space-y-3">
            <a
              href={proofSrc}
              target="_blank"
              rel="noreferrer"
              className="inline-block font-sans text-sm uppercase tracking-wider text-choc underline underline-offset-4"
            >
              Open receipt in a new tab
            </a>
            {pending ? (
              <>
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
                <p className="font-body text-sm text-charcoal-mid">
                  Leave blank if the full amount landed. Enter a shortfall only if the bank credited less.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void confirm()}
                  className="w-full bg-[#1B5E20] px-4 py-3 font-sans text-sm uppercase tracking-wider text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Approve payment"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRejectOpen(true)}
                  className="w-full border border-red-300 px-4 py-3 font-sans text-sm uppercase tracking-wider text-red-800 disabled:opacity-50"
                >
                  Reject receipt
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {lightbox && receiptUrl ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal
        >
          <div className="relative max-h-[90vh] max-w-4xl glass-opaque p-3" onClick={(e) => e.stopPropagation()}>
            <Image
              src={proofSrc}
              alt="Payment receipt"
              width={1200}
              height={1600}
              className="max-h-[85vh] w-auto object-contain"
              unoptimized
            />
            <button
              type="button"
              className="absolute right-2 top-2 bg-white px-3 py-2 text-sm uppercase"
              onClick={() => setLightbox(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {rejectOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white p-6">
            <p className="font-display text-xl text-choc">Reject this receipt</p>
            <p className="mt-2 font-body text-base text-charcoal-mid">
              The customer will be emailed this reason.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Blurry image, wrong amount, name does not match…"
              className="mt-4 w-full border border-sand p-3 font-body text-base"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="px-4 py-2 text-sm uppercase" onClick={() => setRejectOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="bg-red-700 px-4 py-2 text-sm uppercase text-white disabled:opacity-50"
                onClick={() => void reject()}
              >
                Reject receipt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
