"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { KNOWN_QUOTE_CARRIERS } from "@/lib/shipping/mode";
import type { OrderStatus } from "@prisma/client";

export function ShippingQuotePanel({
  orderId,
  currentShipping,
  currentCarrier,
  currentNote,
  orderStatus,
  preferredContact,
  whatsappUrl,
  payUrl,
  reminderCount = 0,
}: {
  orderId: string;
  currentShipping: number;
  currentCarrier?: string | null;
  currentNote?: string | null;
  orderStatus: OrderStatus;
  preferredContact?: string | null;
  whatsappUrl?: string | null;
  /** The client's lasting Paystack pay link, once a quote is saved. */
  payUrl?: string | null;
  reminderCount?: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(currentShipping || ""));
  const [carrier, setCarrier] = useState(currentCarrier ?? "");
  const [note, setNote] = useState(currentNote ?? "");
  const [busy, setBusy] = useState(false);
  const packed = orderStatus === "PROCESSING";

  async function save() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a shipping amount");
      return;
    }
    const agreed = carrier.trim();
    if (!agreed) {
      toast.error("Record the carrier you agreed");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipping-quote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountNGN: n, carrier: agreed, note: note.trim() || undefined, notify: true }),
      });
      const data = (await res.json()) as { error?: string; notified?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Could not save quote");
      if (data.notified) toast.success("Quote saved. The client was emailed a Paystack pay link.");
      else toast.success("Quote saved. No email was sent (nothing to pay, or no email on the order).");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function copyPayLink() {
    if (!payUrl) return;
    try {
      await navigator.clipboard.writeText(payUrl);
      toast.success("Pay link copied. Paste it into WhatsApp.");
    } catch {
      toast.error("Could not copy. Select the link and copy it.");
    }
  }

  const contactLabel =
    preferredContact === "WHATSAPP" ? "WhatsApp" : preferredContact === "CALL" ? "Phone call" : preferredContact === "EMAIL" ? "Email" : null;

  return (
    <div className="glass-opaque p-6">
      <p className="font-label text-xs uppercase text-text-light">Shipping quote</p>
      {packed ? (
        <p className="mt-1 font-body text-sm text-ink">
          The piece is in processing — agree the courier and cost with the client, then save.
        </p>
      ) : (
        <p className="mt-1 font-body text-sm text-text-mid">
          Prudent Gabriel usually agrees shipping after the piece is packed. You can quote now if you have already spoken to
          the client.
        </p>
      )}
      {contactLabel ? (
        <p className="mt-2 font-body text-xs text-text-mid">
          Preferred contact: {contactLabel}
          {whatsappUrl ? (
            <>
              {" "}
              ·{" "}
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="text-olive hover:underline">
                Open WhatsApp
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-text-light">
          Amount (₦)
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block border border-sand bg-canvas px-3 py-2 text-sm text-charcoal"
          />
        </label>
        <label className="text-xs text-text-light">
          Carrier
          <input
            list="quote-carriers"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="DHL, GIG, Kwik…"
            className="mt-1 block border border-sand bg-canvas px-3 py-2 text-sm text-charcoal"
          />
          <datalist id="quote-carriers">
            {KNOWN_QUOTE_CARRIERS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="min-w-[220px] flex-1 text-xs text-text-light">
          Note
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you agreed"
            className="mt-1 block w-full border border-sand bg-canvas px-3 py-2 text-sm text-charcoal"
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
      <p className="mt-3 font-body text-xs text-text-mid">
        The client gets an email with a Pay shipping button (Paystack), sees it as a pending payment in their
        account, and gets a reminder every few days until it is paid.
      </p>
      {payUrl ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-sand pt-3">
          <span className="font-body text-xs text-text-mid">
            Awaiting payment
            {reminderCount > 0 ? ` · ${reminderCount} reminder${reminderCount === 1 ? "" : "s"} sent` : ""}
          </span>
          <input
            readOnly
            value={payUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-[200px] flex-1 border border-sand bg-canvas px-2 py-1 text-xs text-charcoal"
            aria-label="Client pay link"
          />
          <button
            type="button"
            onClick={() => void copyPayLink()}
            className="border border-olive px-3 py-1 text-xs text-olive hover:bg-olive hover:text-white"
          >
            Copy pay link
          </button>
        </div>
      ) : null}
    </div>
  );
}
