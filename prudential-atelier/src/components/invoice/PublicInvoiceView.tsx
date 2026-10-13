"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { formatInvoiceCurrency, resolveAssetUrl } from "@/lib/invoice";
import type { InvoiceCurrency } from "@/types/invoice";
import type { PublicInvoiceViewPayload } from "@/lib/public-invoice-payload";
import { PublicInvoicePayClient } from "@/components/invoice/PublicInvoicePayClient";

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
  const [data, setData] = useState<PublicInvoiceViewPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoice/${token}`);
    if (!res.ok) {
      setErr("notfound");
      return;
    }
    setData((await res.json()) as PublicInvoiceViewPayload);
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
        <p className="mt-2 font-body text-sm text-text-mid">This link may be invalid or expired.</p>
      </div>
    );
  }

  if (!data) {
    return <p className="p-12 text-center font-body text-sm text-text-mid">Loading…</p>;
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
      {data.expired ? (
        <div className="px-6 py-3 font-body text-sm" style={{ backgroundColor: "#FDECEA", color: "#8B1A1A" }}>
          This quoted price expired
          {data.expiresAt ? ` on ${new Date(data.expiresAt).toLocaleDateString("en-GB")}` : ""}. You can still pay;
          the house may honour or revise the figure.
        </div>
      ) : null}

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            {logoSrc ? (
              <div className="relative h-14 w-[120px]">
                <Image src={logoSrc} alt="" fill className="object-contain object-left" unoptimized />
              </div>
            ) : null}
            <p className="mt-4 font-display text-xl text-ink">{b.businessName}</p>
            <p className="font-body text-xs text-text-mid">{b.tagline}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-4xl italic text-ink">Invoice</p>
            <p className="mt-1 font-mono text-sm text-olive">{data.invoiceNumber}</p>
          </div>
        </div>
        <div className="mt-6 h-0.5 bg-olive" />
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-text-mid">Date issued</p>
            <p className="mt-1 font-body text-sm text-ink">{new Date(data.createdAt).toLocaleDateString("en-GB")}</p>
          </div>
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-text-mid">Valid until</p>
            <p className="mt-1 font-body text-sm font-medium text-ink">
              {data.expiresAt ? new Date(data.expiresAt).toLocaleDateString("en-GB") : "—"}
            </p>
          </div>
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-text-mid">Due date</p>
            <p className="mt-1 font-body text-sm font-medium text-ink">
              {data.dueDate ? new Date(data.dueDate).toLocaleDateString("en-GB") : "—"}
            </p>
          </div>
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-text-mid">Invoice #</p>
            <p className="mt-1 font-body text-sm text-olive">{data.invoiceNumber}</p>
          </div>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-text-mid">From</p>
            <p className="mt-2 font-body text-sm font-medium text-ink">{b.businessName}</p>
            <p className="font-body text-xs text-text-mid">{b.addressLine1}</p>
            <p className="font-body text-xs text-text-mid">{b.addressLine2}</p>
            <p className="font-body text-xs text-text-mid">{b.city}</p>
            <p className="font-body text-xs text-text-mid">{b.phone}</p>
            <p className="font-body text-xs text-olive">{b.email}</p>
          </div>
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-text-mid">Bill to</p>
            <p className="mt-2 font-body text-sm font-medium text-ink">{data.addresseeName}</p>
          </div>
        </div>

        <div className="mt-10 overflow-x-auto rounded-sm border border-border">
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
                <tr key={li.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{li.description}</div>
                    {li.details ? <div className="text-xs italic text-text-light">{li.details}</div> : null}
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
                <span>{data.depositLabel}</span>
              </div>
              <div className="flex justify-end gap-8">
                <span>Balance due</span>
                <span className={data.balanceDue > 0 ? "text-error" : "text-success"}>
                  {formatInvoiceCurrency(data.balanceDue, cur)}
                </span>
              </div>
            </>
          ) : null}
        </div>

        {data.payInstruction ? (
          <div className="mt-8 border border-border bg-bg-page p-5">
            <p className="font-body text-[10px] font-medium uppercase text-text-mid">Kindly pay</p>
            <p className="mt-2 font-body text-sm text-ink">{data.payInstruction}</p>
          </div>
        ) : null}

        {data.paymentTerms ? (
          <div className="mt-8 border border-border bg-bg-page p-5">
            <p className="font-body text-[10px] font-medium uppercase text-text-mid">Payment terms</p>
            <p className="mt-2 font-body text-sm text-text-mid">{data.paymentTerms}</p>
          </div>
        ) : null}

        {bank.accountNumber ? (
        <div className="mt-6 font-body text-sm">
          <p className="text-[10px] font-medium uppercase text-text-mid">Payment details ({bank.currency})</p>
          <p className="mt-2 text-text-mid">{bank.bankName}</p>
          <p className="text-text-mid">{bank.accountName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg text-olive">{bank.accountNumber}</span>
            <button type="button" className="text-xs text-olive underline" onClick={() => void copyAcct(bank.accountNumber)}>
              Copy
            </button>
          </div>
          {bank.sortCode ? <p className="mt-1 text-xs text-text-mid">Sort code: {bank.sortCode}</p> : null}
          {bank.iban ? <p className="mt-1 text-xs text-text-mid">IBAN: {bank.iban}</p> : null}
          {bank.swiftBic ? <p className="mt-1 text-xs text-text-mid">SWIFT / BIC: {bank.swiftBic}</p> : null}
          {bank.routingNumber ? (
            <p className="mt-1 text-xs text-text-mid">Routing number: {bank.routingNumber}</p>
          ) : null}
          {bank.intermediaryBank ? (
            <p className="mt-1 whitespace-pre-wrap text-xs text-text-mid">{bank.intermediaryBank}</p>
          ) : null}
          {bank.instructions ? (
            <p className="mt-2 whitespace-pre-wrap text-xs text-text-mid">{bank.instructions}</p>
          ) : null}
        </div>
        ) : null}

        {data.houseTerms?.length ? (
          <div className="mt-8 border border-border bg-bg-page p-5">
            <p className="font-body text-[10px] font-medium uppercase text-text-mid">Terms</p>
            <ul className="mt-3 space-y-3">
              {data.houseTerms.map((term) => (
                <li key={term.key}>
                  <p className="font-body text-sm font-medium text-ink">{term.title}</p>
                  <p className="mt-1 font-body text-sm text-text-mid">{term.body}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {data.clientNote ? <p className="mt-6 font-body text-sm italic text-text-mid">{data.clientNote}</p> : null}

        <PublicInvoicePayClient token={token} pay={data.pay} currency={data.currency} />

        {b.footerNote ? (
          <p className="mt-10 text-center font-display text-lg italic text-text-mid">{b.footerNote}</p>
        ) : null}
        {b.footerHandle ? (
          <p className="mt-2 text-center font-body text-xs tracking-[0.12em] text-text-mid">{b.footerHandle}</p>
        ) : null}
      </main>

      <div className="fixed bottom-0 left-0 right-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-bg-card px-6 py-4">
        <a
          href={`/api/invoice/${token}/pdf`}
          className="inline-flex items-center bg-[#37392d] px-4 py-2 font-body text-[11px] font-medium uppercase tracking-[0.1em] text-white"
        >
          Download PDF
        </a>
        <button
          type="button"
          className="border border-[#37392d] px-4 py-2 font-body text-[11px] uppercase text-ink"
          onClick={async () => {
            const res = await fetch(`/api/invoice/${token}/email-copy`, { method: "POST" });
            if (!res.ok) toast.error("Could not send");
            else toast.success("Check your inbox");
          }}
        >
          Email me a copy
        </button>
        <span className="hidden text-xs text-text-light sm:inline">Secured by Prudential Atelier</span>
      </div>
    </div>
  );
}
