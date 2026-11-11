"use client";

import { useState } from "react";

/** Makes a fresh Paystack checkout and sends her to it. */
export function ShippingPayButton({ orderId, code }: { orderId: string; code: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payment/shipping/${encodeURIComponent(orderId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: code }),
      });
      const data = (await res.json().catch(() => ({}))) as { authorizationUrl?: string; error?: unknown };
      if (!res.ok || !data.authorizationUrl) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not open Paystack. Please try again.");
      }
      window.location.href = data.authorizationUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open Paystack. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void pay()}
        disabled={busy}
        className="btn-primary w-full justify-center py-3 disabled:opacity-60"
      >
        {busy ? "Opening Paystack…" : "Pay with Paystack"}
      </button>
      {error ? <p className="mt-2 font-body text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
