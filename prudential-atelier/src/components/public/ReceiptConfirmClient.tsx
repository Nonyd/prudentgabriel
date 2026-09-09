"use client";

import { useState } from "react";
import { AlterationReason } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { PublicReceiptPayload } from "@/lib/public-receipt-payload";

const REASONS: { value: AlterationReason; label: string }[] = [
  { value: "FIT", label: "Fit" },
  { value: "WORKMANSHIP", label: "Workmanship" },
  { value: "DAMAGE", label: "Damage" },
  { value: "CHANGE_REQUESTED", label: "Change requested" },
  { value: "OTHER", label: "Other" },
];

function formatDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ReceiptConfirmClient({
  token,
  view: initial,
}: {
  token: string;
  view: PublicReceiptPayload;
}) {
  const [view, setView] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<AlterationReason>("FIT");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/receipt/${token}/confirm`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not confirm");
      toast.success("Receipt confirmed");
      setView((v) => ({
        ...v,
        receiptConfirmedAt: new Date().toISOString(),
        warrantyEndsAt: data.warrantyEndsAt ?? v.warrantyEndsAt,
        windowOpen: true,
      }));
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
      const res = await fetch(`/api/receipt/${token}/alterations`, {
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

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-display text-3xl text-choc">Confirm receipt</h1>
      <p className="mt-3 font-sans text-sm text-text-mid">
        Commission <strong>{view.orderRef}</strong>
        {view.receiptConfirmedAt
          ? " — receipt confirmed."
          : " — please confirm you have received your garment."}
      </p>
      {!view.receiptConfirmedAt && !view.archived ? (
        <Button className="mt-8" onClick={confirm} disabled={confirming}>
          {confirming ? "Confirming…" : "I have received my garment"}
        </Button>
      ) : null}

      {view.windowOpen && view.warrantyEndsAt ? (
        <section className="mt-10 rounded border border-sand/60 px-5 py-4 text-left">
          <h2 className="font-display text-xl text-choc">Request an alteration</h2>
          <p className="mt-1 font-sans text-sm text-text-mid">
            You have until {formatDay(view.warrantyEndsAt)} to request a fit or workmanship
            tweak. Confirming receipt opened this window; it does not close your file.
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
      ) : null}

      {view.archived ? (
        <p className="mt-8 font-sans text-sm text-text-mid">This commission is archived.</p>
      ) : null}
    </div>
  );
}
