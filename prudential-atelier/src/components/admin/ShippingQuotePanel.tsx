"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export function ShippingQuotePanel({ orderId, currentShipping }: { orderId: string; currentShipping: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(currentShipping || ""));
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a shipping amount");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipping-quote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountNGN: n, notify: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save quote");
      toast.success("Quote saved and customer notified");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-sm border border-sand bg-canvas p-6">
      <p className="font-label text-xs uppercase text-[#A8A8A4]">Shipping quote</p>
      <p className="mt-1 font-body text-sm text-[#6B6B68]">
        Set the fee, then we raise the order total and email a payment link. They already paid for the garment.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-[#A8A8A4]">
          Amount (₦)
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block border border-sand bg-canvas px-3 py-2 text-sm text-charcoal"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="bg-olive px-4 py-2 text-xs text-white hover:bg-olive-hover disabled:opacity-50"
        >
          Save quote and notify
        </button>
      </div>
    </div>
  );
}
