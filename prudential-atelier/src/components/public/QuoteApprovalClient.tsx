"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { QuoteStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatDate, formatPrice } from "@/lib/utils";

type QuoteLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type QuoteApprovalData = {
  id: string;
  quoteRef: string;
  clientName: string;
  clientEmail: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes: string | null;
  status: QuoteStatus;
  expiresAt: string | null;
  approvalToken: string;
};

export function QuoteApprovalClient({ quote }: { quote: QuoteApprovalData }) {
  const [status, setStatus] = useState(quote.status);
  const [approving, setApproving] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changeMessage, setChangeMessage] = useState("");

  const expired = quote.expiresAt ? new Date(quote.expiresAt) < new Date() : false;
  const canApprove =
    !expired && status !== "APPROVED" && status !== "CONVERTED" && status !== "REJECTED";

  async function approve() {
    setApproving(true);
    try {
      const res = await fetch(`/api/quotations/${quote.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalToken: quote.approvalToken }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Approval failed");
        return;
      }
      toast.success(data.message ?? "Quotation approved");
      setStatus("APPROVED");
    } finally {
      setApproving(false);
    }
  }

  function requestChanges() {
    const subject = encodeURIComponent(`Quote change request — ${quote.quoteRef}`);
    const body = encodeURIComponent(
      changeMessage ||
        `Hi,\n\nI would like to request changes to quotation ${quote.quoteRef}.\n\n`,
    );
    window.location.href = `mailto:orders@prudentgabriel.com?subject=${subject}&body=${body}`;
    setChangesOpen(false);
    toast.success("Opening email client");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">
          Prudent Gabriel
        </p>
        <h1 className="mt-3 font-serif text-4xl font-medium text-choc">Your Quotation</h1>
        <p className="mt-2 font-sans text-sm text-text-mid">{quote.quoteRef}</p>
      </div>

      <div className="mt-10 card-surface overflow-hidden">
        <div className="border-b border-sand bg-choc/5 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-sans text-sm text-text-mid">Prepared for</p>
              <p className="font-serif text-xl text-choc">{quote.clientName}</p>
              <p className="font-sans text-xs text-text-light">{quote.clientEmail}</p>
            </div>
            <Badge variant={status === "APPROVED" ? "success" : "gold"}>{status}</Badge>
          </div>
          {quote.expiresAt ? (
            <p className="mt-3 font-sans text-xs text-text-mid">
              Valid until {formatDate(quote.expiresAt)}
              {expired ? " (expired)" : ""}
            </p>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left">
            <thead>
              <tr className="border-b border-sand font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-text-light">
                <th className="px-6 py-3">Description</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Unit</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.lineItems.map((item, i) => (
                <tr key={i} className="border-b border-sand/60">
                  <td className="px-6 py-3 font-sans text-sm">{item.description}</td>
                  <td className="px-4 py-3 text-center font-sans text-sm">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-sans text-sm">
                    {formatPrice(item.unitPrice, "NGN")}
                  </td>
                  <td className="px-6 py-3 text-right font-sans text-sm">
                    {formatPrice(item.total, "NGN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1 border-t border-sand px-6 py-4 text-right font-sans text-sm">
          <p className="text-text-mid">Subtotal {formatPrice(quote.subtotal, "NGN")}</p>
          {quote.tax > 0 ? <p className="text-text-mid">Tax {formatPrice(quote.tax, "NGN")}</p> : null}
          {quote.discount > 0 ? (
            <p className="text-text-mid">Discount −{formatPrice(quote.discount, "NGN")}</p>
          ) : null}
          <p className="font-serif text-xl text-choc">Total {formatPrice(quote.total, "NGN")}</p>
        </div>

        {quote.notes ? (
          <div className="border-t border-sand px-6 py-4">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
              Notes
            </p>
            <p className="mt-2 font-sans text-sm text-text-mid whitespace-pre-wrap">{quote.notes}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-sand px-6 py-6 sm:flex-row sm:justify-center">
          {canApprove ? (
            <Button loading={approving} onClick={() => void approve()}>
              Approve this Quote
            </Button>
          ) : status === "APPROVED" ? (
            <p className="text-center font-sans text-sm text-success">
              Thank you — this quotation has been approved.
            </p>
          ) : (
            <p className="text-center font-sans text-sm text-text-mid">
              This quotation is no longer available for approval.
            </p>
          )}
          {canApprove ? (
            <Button variant="secondary" onClick={() => setChangesOpen(true)}>
              Request Changes
            </Button>
          ) : null}
        </div>
      </div>

      <Modal open={changesOpen} onClose={() => setChangesOpen(false)} title="Request changes">
        <textarea
          rows={4}
          value={changeMessage}
          onChange={(e) => setChangeMessage(e.target.value)}
          placeholder="Describe the changes you need…"
          className="mt-4 w-full rounded border border-sand px-3 py-2 font-sans text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setChangesOpen(false)}>
            Cancel
          </Button>
          <Button onClick={requestChanges}>Send Request</Button>
        </div>
      </Modal>
    </div>
  );
}
