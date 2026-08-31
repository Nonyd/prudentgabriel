"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { InvoicesQuotationsNav } from "@/components/admin/InvoicesQuotationsNav";
import { formatInvoiceCurrency } from "@/lib/invoice";
import type { InvoiceCurrency } from "@/types/invoice";

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type LinkedConsultation = {
  id: string;
  bookingNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  occasion: string;
  sessionNotes: string | null;
  description: string;
  moodboardImages: string[];
  completedAt: string | null;
  sessionType: string;
};

const SUGGESTED_LINE_ITEMS = [
  "Design & Construction",
  "Fabric & Materials",
  "Beading & Embellishment",
];

function calcLineTotal(qty: number, price: number) {
  return Math.round(qty * price * 100) / 100;
}

function applyConsultationToForm(
  c: LinkedConsultation,
  setters: {
    setClientName: (v: string) => void;
    setClientEmail: (v: string) => void;
    setClientPhone: (v: string) => void;
    setNotes: (v: string) => void;
    setLineItems: (v: LineItem[]) => void;
    setLinkedConsultation: (v: LinkedConsultation) => void;
    setConsultationId: (v: string) => void;
  },
) {
  setters.setConsultationId(c.id);
  setters.setLinkedConsultation(c);
  setters.setClientName(c.clientName);
  setters.setClientEmail(c.clientEmail);
  setters.setClientPhone(c.clientPhone);
  setters.setNotes(c.sessionNotes ?? c.description ?? "");
  setters.setLineItems(
    SUGGESTED_LINE_ITEMS.map((description) => ({
      description,
      quantity: 1,
      unitPrice: 0,
      total: 0,
    })),
  );
}

export function QuotationFormClient({ consultationId: initialConsultationId }: { consultationId?: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [expiresAt, setExpiresAt] = useState("");
  const [currency, setCurrency] = useState<InvoiceCurrency>("NGN");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [consultationId, setConsultationId] = useState<string | null>(initialConsultationId ?? null);
  const [linkedConsultation, setLinkedConsultation] = useState<LinkedConsultation | null>(null);
  const [consultationRefSearch, setConsultationRefSearch] = useState("");
  const [searchingConsultation, setSearchingConsultation] = useState(false);
  const [searchResult, setSearchResult] = useState<LinkedConsultation | null>(null);
  const [searchNotFound, setSearchNotFound] = useState(false);

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
  const total = Math.max(0, Math.round((subtotal + tax - discount) * 100) / 100);

  const loadConsultation = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/consultations/${id}`);
    if (!res.ok) return;
    const j = (await res.json()) as {
      booking: {
        id: string;
        bookingNumber: string;
        clientName: string;
        clientEmail: string;
        clientPhone: string;
        occasion: string;
        sessionNotes: string | null;
        description: string;
        moodboardImages: string[];
        completedAt: string | null;
        offering?: { sessionType?: string };
        offeringType?: string | null;
      };
    };
    const b = j.booking;
    applyConsultationToForm(
      {
        id: b.id,
        bookingNumber: b.bookingNumber,
        clientName: b.clientName,
        clientEmail: b.clientEmail,
        clientPhone: b.clientPhone,
        occasion: b.occasion,
        sessionNotes: b.sessionNotes,
        description: b.description,
        moodboardImages: b.moodboardImages ?? [],
        completedAt: b.completedAt,
        sessionType: b.offering?.sessionType?.replace(/_/g, " ") ?? "Consultation",
      },
      {
        setClientName,
        setClientEmail,
        setClientPhone,
        setNotes,
        setLineItems,
        setLinkedConsultation,
        setConsultationId,
      },
    );
  }, []);

  useEffect(() => {
    if (initialConsultationId) {
      void loadConsultation(initialConsultationId);
    }
  }, [initialConsultationId, loadConsultation]);

  function updateLine(index: number, patch: Partial<LineItem>) {
    setLineItems((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        next.total = calcLineTotal(next.quantity, next.unitPrice);
        return next;
      }),
    );
  }

  async function searchConsultation() {
    const ref = consultationRefSearch.trim();
    if (!ref) {
      toast.error("Enter a consultation reference");
      return;
    }
    setSearchingConsultation(true);
    setSearchNotFound(false);
    setSearchResult(null);
    try {
      const res = await fetch(`/api/admin/consultations/search?ref=${encodeURIComponent(ref)}`);
      const j = (await res.json()) as {
        found: boolean;
        booking?: LinkedConsultation & { hasQuotation?: boolean };
      };
      if (!j.found || !j.booking) {
        setSearchNotFound(true);
        return;
      }
      if (j.booking.hasQuotation) {
        toast.error("This consultation already has a quotation linked");
        return;
      }
      setSearchResult(j.booking);
    } finally {
      setSearchingConsultation(false);
    }
  }

  function linkSearchedConsultation() {
    if (!searchResult) return;
    applyConsultationToForm(searchResult, {
      setClientName,
      setClientEmail,
      setClientPhone,
      setNotes,
      setLineItems,
      setLinkedConsultation,
      setConsultationId,
    });
    setSearchResult(null);
    setConsultationRefSearch("");
    setSearchNotFound(false);
    toast.success("Consultation linked");
  }

  async function handleSubmit(sendAfter = false) {
    if (!clientName.trim() || !clientEmail.trim()) {
      toast.error("Client name and email are required");
      return;
    }
    const validItems = lineItems.filter((i) => i.description.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error("Add at least one line item");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientEmail,
          clientPhone: clientPhone || undefined,
          lineItems: validItems,
          tax,
          discount,
          notes: notes || undefined,
          expiresAt: expiresAt || undefined,
          currency,
          consultationId: consultationId ?? undefined,
        }),
      });
      const data = (await res.json()) as { item?: { id: string }; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create quotation");
        return;
      }

      toast.success("Quotation saved as draft");
      if (sendAfter && data.item?.id) {
        const sendRes = await fetch(`/api/quotations/${data.item.id}/send`, { method: "POST" });
        if (!sendRes.ok) {
          toast.error("Saved but failed to send");
        } else {
          toast.success("Quotation sent to client");
        }
      }
      router.push("/admin/quotations");
    } finally {
      setSaving(false);
    }
  }

  const quoteTitle = linkedConsultation
    ? `Atelier Commission — ${linkedConsultation.occasion}`
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/quotations"
          className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light hover:text-nut"
        >
          ← Back to quotations
        </Link>
        <InvoicesQuotationsNav />
        <h1 className="mt-2 font-display text-2xl text-ink">New Quotation</h1>
        {quoteTitle ? (
          <p className="mt-1 font-sans text-sm text-text-mid">{quoteTitle}</p>
        ) : null}
      </div>

      <div className="card-surface space-y-6 p-6">
        {!initialConsultationId ? (
          <section className="border-b border-sand pb-6">
            <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
              Link consultation (optional)
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={consultationRefSearch}
                onChange={(e) => {
                  setConsultationRefSearch(e.target.value);
                  setSearchNotFound(false);
                }}
                placeholder="e.g. DEMO-CB-004"
                className="min-w-[12rem] flex-1 rounded border border-sand px-3 py-2 font-sans text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={searchingConsultation}
                onClick={() => void searchConsultation()}
              >
                Search
              </Button>
            </div>
            {searchNotFound ? (
              <p className="mt-2 font-sans text-sm text-danger">No consultation found with that reference.</p>
            ) : null}
            {searchResult ? (
              <div className="mt-3 rounded border border-sand/80 bg-ivory p-4">
                <p className="font-sans text-sm text-ink">
                  ✓ Found: {searchResult.clientName} — {searchResult.sessionType}
                </p>
                {searchResult.completedAt ? (
                  <p className="mt-1 font-sans text-xs text-text-mid">
                    Completed:{" "}
                    {new Date(searchResult.completedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                ) : null}
                {searchResult.sessionNotes ? (
                  <p className="mt-2 line-clamp-2 font-sans text-xs text-text-mid">
                    Session notes: &ldquo;{searchResult.sessionNotes}&rdquo;
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={linkSearchedConsultation}
                  className="mt-3 font-sans text-xs font-semibold uppercase tracking-wide text-nut underline-offset-2 hover:underline"
                >
                  Link this consultation
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {linkedConsultation ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-lightbr/15 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-wide text-lightbr">
            Linked to consultation {linkedConsultation.bookingNumber}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Client name</span>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Email</span>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Phone</span>
            <input
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
          </label>
        </section>

        <section>
          <p className="mb-2 font-sans text-xs font-medium text-text-mid">Currency</p>
          <div className="flex flex-wrap gap-2">
            {(["NGN", "USD", "GBP", "EUR"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`border px-4 py-2 font-body text-xs ${currency === c ? "border-[#37392d] ring-1 ring-[#37392d]" : "border-sand"}`}
              >
                {c}
              </button>
            ))}
          </div>
          {currency === "EUR" ? (
            <p className="mt-2 font-body text-xs text-[#6B6B68]">
              Euro is for this quotation and the invoice it becomes — not a storefront checkout currency.
            </p>
          ) : null}
        </section>

        {linkedConsultation && linkedConsultation.moodboardImages.length > 0 ? (
          <section>
            <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
              Reference images
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {linkedConsultation.moodboardImages.map((url) => (
                <div
                  key={url}
                  className="relative h-20 w-20 overflow-hidden rounded border border-sand"
                >
                  <Image src={url} alt="" fill className="object-cover" sizes="80px" unoptimized />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
              Line items
            </h2>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setLineItems((rows) => [
                  ...rows,
                  { description: "", quantity: 1, unitPrice: 0, total: 0 },
                ])
              }
            >
              Add row
            </Button>
          </div>
          <div className="space-y-3">
            {lineItems.map((row, index) => (
              <div key={index} className="grid gap-2 rounded border border-sand/60 p-3 sm:grid-cols-12">
                <input
                  placeholder="Description"
                  value={row.description}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                  className="sm:col-span-5 rounded border border-sand px-2 py-2 font-sans text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                  className="sm:col-span-2 rounded border border-sand px-2 py-2 font-sans text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={row.unitPrice}
                  onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) || 0 })}
                  className="sm:col-span-2 rounded border border-sand px-2 py-2 font-sans text-sm"
                />
                <div className="sm:col-span-2 flex items-center font-sans text-sm text-text-mid">
                  {formatInvoiceCurrency(row.total, currency)}
                </div>
                <button
                  type="button"
                  onClick={() => setLineItems((rows) => rows.filter((_, i) => i !== index))}
                  className="sm:col-span-1 font-sans text-xs text-danger"
                  disabled={lineItems.length === 1}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Tax ({currency})</span>
            <input
              type="number"
              min={0}
              value={tax}
              onChange={(e) => setTax(Number(e.target.value) || 0)}
              className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Discount ({currency})</span>
            <input
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Expires</span>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
          </label>
        </section>

        <label className="block">
          <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Notes to client</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-sand pt-4">
          <div className="font-sans text-sm text-text-mid">
            Subtotal {formatInvoiceCurrency(subtotal, currency)} · Total{" "}
            <span className="font-semibold text-choc">{formatInvoiceCurrency(total, currency)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" loading={saving} onClick={() => void handleSubmit(false)}>
              Save Draft
            </Button>
            <Button loading={saving} onClick={() => void handleSubmit(true)}>
              Send to Client
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
