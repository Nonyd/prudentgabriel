"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { adminReceiptSrc } from "@/lib/media/admin-receipt-src";

type Props = {
  id: string;
  bookingNumber: string;
  feeNGN: number;
  receiptUrl: string | null;
  /** Compact: one line for the bookings table. */
  compact?: boolean;
};

/**
 * Confirm or reject a consultation's bank transfer from the booking itself,
 * through the same endpoints as the Payments page: the ledger row, emails and
 * status move are identical whichever page it is done from.
 */
export function ConsultationPaymentControl({ id, bookingNumber, feeNGN, receiptUrl, compact = false }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"confirm" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = `₦${feeNGN.toLocaleString("en-NG")}`;

  async function send(action: "confirm" | "reject") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/payments/booking-${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { reason: reason.trim() } : {}),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        throw new Error(
          typeof j.error === "string"
            ? j.error
            : res.status === 403
              ? "You need the payments permission to do this."
              : "Could not save",
        );
      }
      toast.success(action === "confirm" ? `${bookingNumber}: payment confirmed` : `${bookingNumber}: transfer rejected`);
      setMode(null);
      // The detail page keeps the status in local state; a full reload shows the new one.
      if (compact) router.refresh();
      else window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const receipt = receiptUrl ? (
    <a href={adminReceiptSrc(receiptUrl)} target="_blank" rel="noreferrer" className="text-olive underline">
      {compact ? "Receipt" : "View proof of payment"}
    </a>
  ) : (
    <span className="text-text-mid">{compact ? "No receipt" : "No proof of payment uploaded yet"}</span>
  );

  if (mode === "confirm") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-xs">
        <span className="text-ink">Received {amount}?</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void send("confirm")}
          className="rounded-sm bg-[#37392d] px-3 py-1.5 text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Yes, confirm"}
        </button>
        <button type="button" onClick={() => setMode(null)} className="underline">
          Cancel
        </button>
      </span>
    );
  }

  if (mode === "reject") {
    return (
      <form
        className="flex flex-wrap items-center gap-2 text-xs"
        onSubmit={(e) => {
          e.preventDefault();
          void send("reject");
        }}
      >
        <input
          className="input-field min-w-[200px] flex-1 text-xs"
          placeholder="Why? Sent to the client"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          required
          autoFocus
        />
        <button
          type="submit"
          disabled={busy || !reason.trim()}
          className="rounded-sm border border-error/50 px-3 py-1.5 text-error disabled:opacity-50"
        >
          {busy ? "Saving…" : "Reject"}
        </button>
        <button type="button" onClick={() => setMode(null)} className="underline">
          Cancel
        </button>
      </form>
    );
  }

  if (compact) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMode("confirm")} className="font-medium text-olive underline">
          Confirm payment
        </button>
        <span className="text-sand">·</span>
        {receipt}
      </span>
    );
  }

  return (
    <div className="mt-3 space-y-2 text-xs">
      <p>{receipt}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("confirm")}
          className="rounded-sm bg-[#37392d] px-4 py-2 font-sans text-11px uppercase tracking-[0.1em] text-white"
        >
          Confirm payment
        </button>
        <button
          type="button"
          onClick={() => setMode("reject")}
          className="rounded-sm border border-sand px-4 py-2 font-sans text-11px uppercase tracking-[0.1em] text-ink"
        >
          Reject transfer
        </button>
      </div>
    </div>
  );
}
