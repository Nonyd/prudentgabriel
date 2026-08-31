"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Invoice } from "@prisma/client";
import toast from "react-hot-toast";
import { formatInvoiceCurrency, parseInvoicePaymentHistory } from "@/lib/invoice";
import { getPublicAppUrl } from "@/lib/app-url";
import type { InvoiceCurrency } from "@/types/invoice";

function asCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP" || c === "EUR") return c;
  return "NGN";
}

export type InvoiceDetailInitial = Invoice & {
  bespokeRequest: { id: string; requestNumber: string; occasion: string; status: string } | null;
  bespokeOrder: { id: string; orderRef: string } | null;
};

export function InvoiceDetailAdmin({ initial }: { initial: InvoiceDetailInitial }) {
  const router = useRouter();
  const [inv, setInv] = useState(initial);
  const cur = asCurrency(inv.currency);
  const base = getPublicAppUrl().replace(/\/+$/, "");
  const history = parseInvoicePaymentHistory(inv.paymentHistory);

  const send = async () => {
    const res = await fetch(`/api/admin/invoices/${inv.id}/send`, { method: "POST" });
    if (!res.ok) return toast.error("Send failed");
    toast.success("Sent");
    router.refresh();
  };

  const markPaid = async () => {
    const amount = Number(prompt("Amount received?", String(inv.balanceDue)));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const method = prompt("Method (e.g. Bank Transfer)", "Bank Transfer") ?? "Bank Transfer";
    const reference = prompt("Reference (optional)") ?? undefined;
    const full = confirm("Mark as fully paid? (Cancel = partial payment)");
    const res = await fetch(`/api/admin/invoices/${inv.id}/mark-paid`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method, reference, fullPayment: full }),
    });
    if (!res.ok) return toast.error("Update failed");
    const updated = (await res.json()) as InvoiceDetailInitial;
    setInv((prev) => ({ ...updated, bespokeOrder: updated.bespokeOrder ?? prev.bespokeOrder }));
    toast.success("Payment recorded");
  };

  const cancelInv = async () => {
    if (!confirm("Cancel this invoice?")) return;
    const res = await fetch(`/api/admin/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (!res.ok) return toast.error("Could not cancel");
    const updated = (await res.json()) as InvoiceDetailInitial;
    setInv((prev) => ({ ...updated, bespokeOrder: updated.bespokeOrder ?? prev.bespokeOrder }));
  };

  return (
    <div>
      <Link href="/admin/invoices" className="font-body text-[11px] uppercase text-[#6B6B68] hover:text-ink">
        ← Invoices
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-olive">{inv.invoiceNumber}</h1>
          <p className="mt-1 font-body text-sm text-[#6B6B68]">{inv.clientName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/invoices/${inv.id}/edit`} className="border border-sand px-3 py-2 font-body text-[11px] uppercase">
            Edit
          </Link>
          <a
            href={`${base}/invoice/${inv.publicToken}`}
            target="_blank"
            rel="noreferrer"
            className="border border-sand px-3 py-2 font-body text-[11px] uppercase"
          >
            Public link
          </a>
          <button type="button" className="bg-[#37392d] px-3 py-2 font-body text-[11px] uppercase text-white" onClick={() => void send()}>
            Send
          </button>
          <a className="border border-sand px-3 py-2 font-body text-[11px] uppercase" href={`/api/admin/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
            PDF
          </a>
          {inv.status !== "PAID" && inv.status !== "CANCELLED" ? (
            <button type="button" className="border border-sand px-3 py-2 font-body text-[11px] uppercase" onClick={() => void markPaid()}>
              Mark paid
            </button>
          ) : null}
          {inv.status === "DRAFT" || inv.status === "SENT" || inv.status === "VIEWED" ? (
            <button type="button" className="text-xs text-red-800 underline" onClick={() => void cancelInv()}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="border border-sand bg-canvas p-6 font-body text-sm">
          <p className="text-[11px] uppercase text-[#6B6B68]">Totals</p>
          <dl className="mt-4 space-y-2">
            <div className="flex justify-between">
              <dt>Total</dt>
              <dd>{formatInvoiceCurrency(inv.total, cur)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Balance due</dt>
              <dd className={inv.balanceDue > 0 ? "font-medium text-red-800" : ""}>{formatInvoiceCurrency(inv.balanceDue, cur)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Status</dt>
              <dd>{inv.status.replace(/_/g, " ")}</dd>
            </div>
          </dl>
        </div>
        <div className="border border-sand bg-canvas p-6">
          <p className="font-body text-[11px] uppercase text-[#6B6B68]">Payments</p>
          <ul className="mt-3 space-y-2 font-body text-xs">
            {history.length === 0 ? <li>No payments recorded.</li> : null}
            {history.map((h, i) => (
              <li key={`${h.recordedAt}-${i}`}>
                {new Date(h.recordedAt).toLocaleString("en-GB")} — {formatInvoiceCurrency(h.amount, cur)} — {h.method}
                {h.reference ? ` (${h.reference})` : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {inv.bespokeRequest ? (
        <div className="mt-6 border border-sand bg-[#FAFAF8] p-6">
          <p className="font-body text-[11px] uppercase text-[#6B6B68]">Order</p>
          {inv.bespokeOrder ? (
            <Link className="mt-2 inline-block text-olive underline" href={`/admin/bespoke/${inv.bespokeOrder.id}`}>
              {inv.bespokeOrder.orderRef} — {inv.bespokeRequest.occasion}
            </Link>
          ) : (
            <Link
              className="mt-2 inline-block text-olive underline"
              href={`/admin/bespoke/intake/${inv.bespokeRequest.id}`}
            >
              {inv.bespokeRequest.requestNumber} — {inv.bespokeRequest.occasion}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
