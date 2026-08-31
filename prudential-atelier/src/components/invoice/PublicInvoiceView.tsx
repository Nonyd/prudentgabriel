"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { formatInvoiceCurrency, resolveAssetUrl } from "@/lib/invoice";
import type { InvoiceCurrency, PublicInvoicePayload } from "@/types/invoice";

function asCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP" || c === "EUR") return c;
  return "NGN";
}

function statusBanner(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case "DRAFT":
      return { bg: "#F2F2F0", text: "#37392d", label: "This is a draft invoice" };
    case "SENT":
    case "VIEWED":
      return { bg: "#E8F4FF", text: "#1A5FAD", label: "Invoice sent — awaiting payment" };
    case "PARTIALLY_PAID":
      return { bg: "#FFF8E7", text: "#8D6E00", label: "Deposit received — balance due" };
    case "PAID":
      return { bg: "#E8F5E9", text: "#1B5E20", label: "Paid in full — thank you!" };
    case "OVERDUE":
      return { bg: "#FDECEA", text: "#8B1A1A", label: "This invoice is overdue" };
    default:
      return { bg: "#F2F2F0", text: "#37392d", label: status.replace(/_/g, " ") };
  }
}

export function PublicInvoiceView({ token }: { token: string }) {
  const [data, setData] = useState<PublicInvoicePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoice/${token}`);
    if (!res.ok) {
      setErr("notfound");
      return;
    }
    setData((await res.json()) as PublicInvoicePayload);
    setErr(null);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyAcct = async (num: string) => {
    try {
      await navigator.clipboard.writeText(num);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  if (err === "notfound") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6">
        <h1 className="font-display text-2xl text-ink">Invoice not found</h1>
        <p className="mt-2 font-body text-sm text-[#6B6B68]">This link may be invalid or expired.</p>
      </div>
    );
  }

  if (!data) {
    return <p className="p-12 text-center font-body text-sm text-[#6B6B68]">Loading…</p>;
  }

  const cur = asCurrency(data.currency);
  const b = data.businessDetails;
  const bank = data.bankDetails;
  const banner = statusBanner(data.status);
  const logoSrc = resolveAssetUrl(b.logoUrl);

  return (
    <div className="min-h-screen bg-canvas pb-24">
      <header className="flex items-center justify-between bg-[#37392d] px-6 py-4 text-white">
        <span className="font-body text-[11px] font-medium uppercase tracking-[0.2em]">Prudential Atelier</span>
        <span className="font-body text-xs font-medium">{data.invoiceNumber}</span>
      </header>
      <div className="px-6 py-3 font-body text-sm" style={{ backgroundColor: banner.bg, color: banner.text }}>
        {banner.label}
      </div>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            {logoSrc ? (
              <div className="relative h-14 w-[120px]">
                <Image src={logoSrc} alt="" fill className="object-contain object-left" unoptimized />
              </div>
            ) : null}
            <p className="mt-4 font-display text-xl text-ink">{b.businessName}</p>
            <p className="font-body text-xs text-[#6B6B68]">{b.tagline}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-4xl italic text-ink">Invoice</p>
            <p className="mt-1 font-mono text-sm text-olive">{data.invoiceNumber}</p>
          </div>
        </div>
        <div className="mt-6 h-0.5 bg-olive" />
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B6B68]">Date issued</p>
            <p className="mt-1 font-body text-sm text-ink">{new Date(data.createdAt).toLocaleDateString("en-GB")}</p>
          </div>
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B6B68]">Due date</p>
            <p className="mt-1 font-body text-sm font-medium text-ink">
              {data.dueDate ? new Date(data.dueDate).toLocaleDateString("en-GB") : "—"}
            </p>
          </div>
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B6B68]">Invoice #</p>
            <p className="mt-1 font-body text-sm text-olive">{data.invoiceNumber}</p>
          </div>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B6B68]">From</p>
            <p className="mt-2 font-body text-sm font-medium text-ink">{b.businessName}</p>
            <p className="font-body text-xs text-[#6B6B68]">{b.addressLine1}</p>
            <p className="font-body text-xs text-[#6B6B68]">{b.addressLine2}</p>
            <p className="font-body text-xs text-[#6B6B68]">{b.city}</p>
            <p className="font-body text-xs text-[#6B6B68]">{b.phone}</p>
            <p className="font-body text-xs text-olive">{b.email}</p>
          </div>
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B6B68]">Bill to</p>
            <p className="mt-2 font-body text-sm font-medium text-ink">{data.clientName}</p>
            <p className="font-body text-xs text-[#6B6B68]">{data.clientEmail}</p>
            {data.clientPhone ? <p className="font-body text-xs text-[#6B6B68]">{data.clientPhone}</p> : null}
            {data.clientAddress ? <p className="font-body text-xs text-[#6B6B68]">{data.clientAddress}</p> : null}
            <p className="font-body text-xs text-[#6B6B68]">
              {[data.clientCity, data.clientCountry].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>

        <div className="mt-10 overflow-x-auto rounded-sm border border-[#EBEBEA]">
          <table className="w-full min-w-[500px] border-collapse font-body text-sm">
            <thead>
              <tr className="bg-[#37392d] text-left text-[10px] font-medium uppercase tracking-[0.08em] text-white">
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((li) => (
                <tr key={li.id} className="border-t border-[#EBEBEA]">
                  <td className="px-3 py-2">
                    <div className="font-medium">{li.description}</div>
                    {li.details ? <div className="text-xs italic text-[#8A8A85]">{li.details}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-center">{li.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatInvoiceCurrency(li.unitPrice, cur)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatInvoiceCurrency(li.amount, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 space-y-1 text-right font-body text-sm">
          <div className="flex justify-end gap-8">
            <span>Subtotal</span>
            <span>{formatInvoiceCurrency(data.subtotal, cur)}</span>
          </div>
          {data.discountAmount > 0 ? (
            <div className="flex justify-end gap-8 text-olive">
              <span>Discount</span>
              <span>-{formatInvoiceCurrency(data.discountAmount, cur)}</span>
            </div>
          ) : null}
          {data.showVat && data.vatEnabled && data.vatAmount > 0 ? (
            <div className="flex justify-end gap-8">
              <span>VAT ({data.vatPercent}%)</span>
              <span>{formatInvoiceCurrency(data.vatAmount, cur)}</span>
            </div>
          ) : null}
          <div className="flex justify-end gap-8 text-base font-semibold">
            <span>Total</span>
            <span>{formatInvoiceCurrency(data.total, cur)}</span>
          </div>
          {data.depositRequired > 0 ? (
            <>
              <div className="flex justify-end gap-8 text-olive">
                <span>Deposit required</span>
                <span>{formatInvoiceCurrency(data.depositRequired, cur)}</span>
              </div>
              <div className="flex justify-end gap-8">
                <span>Balance due</span>
                <span className={data.balanceDue > 0 ? "text-red-800" : "text-green-800"}>
                  {formatInvoiceCurrency(data.balanceDue, cur)}
                </span>
              </div>
            </>
          ) : null}
        </div>

        {data.paymentTerms ? (
          <div className="mt-8 border border-[#EBEBEA] bg-[#FAFAF8] p-5">
            <p className="font-body text-[10px] font-medium uppercase text-[#6B6B68]">Payment terms</p>
            <p className="mt-2 font-body text-sm text-[#6B6B68]">{data.paymentTerms}</p>
          </div>
        ) : null}

        <div className="mt-6 font-body text-sm">
          <p className="text-[10px] font-medium uppercase text-[#6B6B68]">Payment details ({bank.currency})</p>
          <p className="mt-2 text-[#6B6B68]">{bank.bankName}</p>
          <p className="text-[#6B6B68]">{bank.accountName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg text-olive">{bank.accountNumber}</span>
            <button type="button" className="text-xs text-olive underline" onClick={() => void copyAcct(bank.accountNumber)}>
              Copy
            </button>
          </div>
          {bank.sortCode ? <p className="mt-1 text-xs text-[#6B6B68]">Sort code: {bank.sortCode}</p> : null}
          {bank.iban ? <p className="mt-1 text-xs text-[#6B6B68]">IBAN: {bank.iban}</p> : null}
          {bank.swiftBic ? <p className="mt-1 text-xs text-[#6B6B68]">SWIFT / BIC: {bank.swiftBic}</p> : null}
          {bank.routingNumber ? (
            <p className="mt-1 text-xs text-[#6B6B68]">Routing number: {bank.routingNumber}</p>
          ) : null}
          {bank.intermediaryBank ? (
            <p className="mt-1 whitespace-pre-wrap text-xs text-[#6B6B68]">{bank.intermediaryBank}</p>
          ) : null}
          {bank.instructions ? (
            <p className="mt-2 whitespace-pre-wrap text-xs text-[#6B6B68]">{bank.instructions}</p>
          ) : null}
        </div>

        {data.clientNote ? <p className="mt-6 font-body text-sm italic text-[#6B6B68]">{data.clientNote}</p> : null}
        {b.footerNote ? (
          <p className="mt-10 text-center font-display text-lg italic text-[#6B6B68]">{b.footerNote}</p>
        ) : null}
      </main>

      <div className="fixed bottom-0 left-0 right-0 flex flex-wrap items-center justify-between gap-3 border-t border-[#EBEBEA] bg-bg-card px-6 py-4">
        <a
          href={`/api/invoice/${token}/pdf`}
          className="inline-flex items-center bg-[#37392d] px-4 py-2 font-body text-[11px] font-medium uppercase tracking-[0.1em] text-white"
        >
          Download PDF
        </a>
        <button
          type="button"
          className="border border-[#37392d] px-4 py-2 font-body text-[11px] uppercase text-[#37392d]"
          onClick={async () => {
            const res = await fetch(`/api/invoice/${token}/email-copy`, { method: "POST" });
            if (!res.ok) toast.error("Could not send");
            else toast.success("Check your inbox");
          }}
        >
          Email me a copy
        </button>
        <span className="hidden text-xs text-[#A8A8A4] sm:inline">Secured by Prudential Atelier</span>
      </div>
    </div>
  );
}
