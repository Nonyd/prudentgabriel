"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";

type PendingItem = {
  id: string;
  kind: "ORDER" | "CONSULTATION" | "BESPOKE";
  ref: string;
  clientName: string;
  clientEmail: string;
  amountNGN: number;
  receiptUrl: string;
  submittedAt: string;
};

export function AdminPendingBankTransfers() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payments/pending");
      const data = (await res.json()) as { items?: PendingItem[] };
      setItems(data.items ?? []);
    } catch {
      toast.error("Could not load pending transfers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/payments/${id}/confirm`, { method: "PATCH" });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "Confirm failed");
      }
      toast.success("Payment confirmed");
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) {
      toast.error("Enter a rejection reason");
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/payments/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "Reject failed");
      }
      toast.success("Payment rejected");
      setRejectId(null);
      setRejectReason("");
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="mt-8 border border-[#EBEBEA] bg-white p-6">
        <p className="font-body text-sm text-[#6B6B68]">Loading pending bank transfers…</p>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <>
      <div className="mt-8 border border-[#C45E0A]/30 bg-[#FFF8F0] p-4">
        <p className="font-body text-[11px] font-medium uppercase tracking-[0.08em] text-[#C45E0A]">
          Pending bank transfers ({items.length})
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse font-body text-sm">
            <thead>
              <tr className="border-b border-[#EBEBEA] text-left text-[10px] uppercase tracking-wide text-[#6B6B68]">
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Reference</th>
                <th className="px-2 py-2">Client</th>
                <th className="px-2 py-2 text-right">Amount (₦)</th>
                <th className="px-2 py-2">Submitted</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[#EBEBEA] last:border-0">
                  <td className="px-2 py-3 text-xs">{item.kind}</td>
                  <td className="px-2 py-3 font-medium">{item.ref}</td>
                  <td className="px-2 py-3 text-xs text-[#6B6B68]">
                    {item.clientName}
                    <br />
                    {item.clientEmail}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">
                    {Math.round(item.amountNGN).toLocaleString("en-NG")}
                  </td>
                  <td className="px-2 py-3 text-xs text-[#6B6B68]">
                    {new Date(item.submittedAt).toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="text-xs uppercase text-[#37392d] underline"
                        onClick={() => setLightbox(item.receiptUrl)}
                      >
                        View receipt
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        className="bg-[#1B5E20] px-3 py-1 text-[10px] uppercase text-white disabled:opacity-50"
                        onClick={() => void confirm(item.id)}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        className="border border-red-200 px-3 py-1 text-[10px] uppercase text-red-700 disabled:opacity-50"
                        onClick={() => {
                          setRejectId(item.id);
                          setRejectReason("");
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal
        >
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image
              src={lightbox}
              alt="Payment receipt"
              width={900}
              height={1200}
              className="max-h-[85vh] w-auto object-contain"
              unoptimized
            />
            <button
              type="button"
              className="absolute right-2 top-2 bg-white px-3 py-1 text-xs uppercase"
              onClick={() => setLightbox(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {rejectId ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white p-6">
            <p className="font-display text-lg text-ink">Reject payment</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Reason for rejection…"
              className="mt-4 w-full border border-[#EBEBEA] p-3 font-body text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="px-4 py-2 text-xs uppercase" onClick={() => setRejectId(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === rejectId}
                className="bg-red-700 px-4 py-2 text-xs uppercase text-white disabled:opacity-50"
                onClick={() => void reject(rejectId)}
              >
                Reject payment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
