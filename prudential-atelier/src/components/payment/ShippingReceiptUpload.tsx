"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Her bank-transfer receipt for the shipping fee, sent for the house to approve. */
export function ShippingReceiptUpload({ orderId, code }: { orderId: string; code: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!file) {
      setError("Choose the receipt picture or PDF first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("orderId", orderId);
      form.set("c", code);
      form.set("file", file);
      const res = await fetch("/api/upload/shipping-receipt", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not send the receipt. Please try again.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the receipt. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-[var(--sand,#e5d9cc)] pt-4">
      <p className="font-body text-sm font-semibold text-[var(--chocolate)]">Paid by transfer? Upload your receipt</p>
      <p className="mt-1 font-body text-xs text-[var(--text-mid)]">
        A screenshot or PDF of the transfer, up to 5MB. We check it against our account and email you once it is
        confirmed.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setError(null);
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="border border-[var(--chocolate)] px-4 py-2 font-body text-sm text-[var(--chocolate)] disabled:opacity-60"
        >
          {file ? "Choose another file" : "Choose receipt"}
        </button>
        {file ? <span className="min-w-0 truncate font-body text-xs text-[var(--text-mid)]">{file.name}</span> : null}
      </div>
      <button
        type="button"
        onClick={() => void send()}
        disabled={busy || !file}
        className="btn-primary mt-3 w-full justify-center py-3 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send receipt"}
      </button>
      {error ? <p className="mt-2 font-body text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
