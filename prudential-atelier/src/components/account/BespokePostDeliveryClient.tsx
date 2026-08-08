"use client";

import { useState } from "react";
import { AlterationReason } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

const REASONS: { value: AlterationReason; label: string }[] = [
  { value: "FIT", label: "Fit" },
  { value: "WORKMANSHIP", label: "Workmanship" },
  { value: "DAMAGE", label: "Damage" },
  { value: "CHANGE_REQUESTED", label: "Change requested" },
  { value: "OTHER", label: "Other" },
];

export function BespokePostDeliveryClient({
  orderId,
  canConfirmReceipt,
  receiptConfirmedAt,
  isArchived,
}: {
  orderId: string;
  canConfirmReceipt: boolean;
  receiptConfirmedAt: string | null;
  isArchived: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<AlterationReason>("FIT");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function confirmReceipt() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/bespoke/${orderId}/confirm-receipt`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not confirm");
      toast.success("Receipt confirmed — thank you");
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setConfirming(false);
    }
  }

  async function submitAlteration(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bespoke/${orderId}/alterations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not submit");
      toast.success("Alteration request submitted");
      setDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (isArchived) {
    return (
      <p className="mt-8 rounded border border-sand/60 bg-ivory/50 px-4 py-3 font-sans text-sm text-text-mid">
        This commission is archived and read-only.
        {receiptConfirmedAt ? " Receipt was confirmed." : null}
      </p>
    );
  }

  return (
    <div className="mt-10 space-y-8">
      {canConfirmReceipt ? (
        <section className="rounded border border-nut/20 bg-ivory px-5 py-4">
          <h2 className="font-display text-xl text-choc">Confirm receipt</h2>
          <p className="mt-1 font-sans text-sm text-text-mid">
            Let us know your garment has arrived safely.
          </p>
          <Button className="mt-4" onClick={confirmReceipt} disabled={confirming}>
            {confirming ? "Confirming…" : "I have received my garment"}
          </Button>
        </section>
      ) : receiptConfirmedAt ? (
        <p className="font-sans text-sm text-nut">
          Receipt confirmed {new Date(receiptConfirmedAt).toLocaleDateString("en-GB")}.
        </p>
      ) : null}

      {(canConfirmReceipt || receiptConfirmedAt) && (
        <section className="rounded border border-sand/60 px-5 py-4">
          <h2 className="font-display text-xl text-choc">Request an alteration</h2>
          <p className="mt-1 font-sans text-sm text-text-mid">
            Post-delivery changes are handled separately from your original commission pipeline.
          </p>
          <form onSubmit={submitAlteration} className="mt-4 space-y-3">
            <label className="block font-sans text-xs uppercase tracking-wide text-nut">
              Reason
              <select
                className="mt-1 w-full border border-sand bg-white px-3 py-2 text-sm text-choc"
                value={reason}
                onChange={(e) => setReason(e.target.value as AlterationReason)}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block font-sans text-xs uppercase tracking-wide text-nut">
              Description
              <textarea
                required
                minLength={10}
                rows={4}
                className="mt-1 w-full border border-sand bg-white px-3 py-2 text-sm text-choc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
