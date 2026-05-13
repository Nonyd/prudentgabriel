"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Invoice } from "@prisma/client";
import { nanoid } from "nanoid";
import toast from "react-hot-toast";
import {
  calculateInvoiceTotals,
  formatInvoiceCurrency,
  syncLineItemAmounts,
} from "@/lib/invoice";
import { getPublicAppUrl } from "@/lib/app-url";
import type { InvoiceCurrency, InvoiceLineItem } from "@/types/invoice";

type Mode = "create" | "edit";

function asCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP") return c;
  return "NGN";
}

export function InvoiceFormPage({ mode, invoiceId }: { mode: Mode; invoiceId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(mode === "edit");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [publicToken, setPublicToken] = useState("");
  const [status, setStatus] = useState<string>("DRAFT");
  const [bespokeRequestId, setBespokeRequestId] = useState<string | null>(null);
  const [bespokeLabel, setBespokeLabel] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientCountry, setClientCountry] = useState("Nigeria");
  const [clientInstagram, setClientInstagram] = useState("");
  const [currency, setCurrency] = useState<InvoiceCurrency>("NGN");
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { id: nanoid(), description: "", quantity: 1, unitPrice: 0, amount: 0 },
  ]);
  const [discountOn, setDiscountOn] = useState(false);
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState(0);
  const [vatOn, setVatOn] = useState(false);
  const [vatPercent, setVatPercent] = useState(0);
  const [depositPct, setDepositPct] = useState(0);
  const [clientNote, setClientNote] = useState("");
  const [notes, setNotes] = useState("");
  const [showVat, setShowVat] = useState(false);
  const [showRc, setShowRc] = useState(false);
  const [bespokeHits, setBespokeHits] = useState<{ id: string; requestNumber: string; name: string; occasion: string }[]>([]);

  const cur = currency;

  const totals = useMemo(() => {
    const synced = syncLineItemAmounts(lineItems);
    return calculateInvoiceTotals({
      lineItems: synced,
      discountType: discountOn ? discountType : undefined,
      discountValue: discountOn ? discountValue : 0,
      vatEnabled: vatOn,
      vatPercent: vatOn ? vatPercent : 0,
      depositPercent: depositPct,
      depositPaid: 0,
    });
  }, [lineItems, discountOn, discountType, discountValue, vatOn, vatPercent, depositPct]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) return;
      const j = (await res.json()) as { settings: Record<string, { key: string; value: string }[]> };
      const inv = j.settings.INVOICE ?? [];
      const pick = (k: string) => inv.find((r) => r.key === k)?.value ?? "";
      setPaymentTerms(pick("invoice_deposit_terms"));
      setVatPercent(Number(pick("invoice_default_vat")) || 0);
      const days = Number(pick("invoice_default_due_days")) || 7;
      const d = new Date();
      d.setDate(d.getDate() + days);
      setDueDate(d.toISOString().slice(0, 10));
    })();
  }, []);

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`);
      if (!res.ok) throw new Error("fail");
      const inv = (await res.json()) as Invoice;
      setInvoiceNumber(inv.invoiceNumber);
      setPublicToken(inv.publicToken);
      setStatus(inv.status);
      setBespokeRequestId(inv.bespokeRequestId);
      setClientName(inv.clientName);
      setClientEmail(inv.clientEmail);
      setClientPhone(inv.clientPhone ?? "");
      setClientAddress(inv.clientAddress ?? "");
      setClientCity(inv.clientCity ?? "");
      setClientCountry(inv.clientCountry);
      setClientInstagram(inv.clientInstagram ?? "");
      setCurrency(asCurrency(inv.currency));
      setDueDate(
        inv.dueDate
          ? (() => {
              const d = new Date(inv.dueDate as Date | string);
              return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
            })()
          : "",
      );
      setPaymentTerms(inv.paymentTerms ?? "");
      const items = Array.isArray(inv.lineItems)
        ? (inv.lineItems as unknown as InvoiceLineItem[])
        : [{ id: nanoid(), description: "", quantity: 1, unitPrice: 0, amount: 0 }];
      setLineItems(items.length ? items : [{ id: nanoid(), description: "", quantity: 1, unitPrice: 0, amount: 0 }]);
      setDiscountOn(inv.discountAmount > 0);
      setDiscountType((inv.discountType as "PERCENTAGE" | "FIXED") || "PERCENTAGE");
      setDiscountValue(inv.discountValue);
      setVatOn(inv.vatEnabled);
      setVatPercent(inv.vatPercent);
      setDepositPct(inv.total > 0 ? Math.round((inv.depositRequired / inv.total) * 100) : 0);
      setClientNote(inv.clientNote ?? "");
      setNotes(inv.notes ?? "");
      setShowVat(inv.showVat);
      setShowRc(inv.showRcNumber);
    } catch {
      toast.error("Could not load invoice");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (mode === "edit") void loadInvoice();
  }, [mode, loadInvoice]);

  const searchBespoke = async (q: string) => {
    if (q.length < 2) {
      setBespokeHits([]);
      return;
    }
    const res = await fetch(`/api/admin/bespoke?search=${encodeURIComponent(q)}`);
    if (!res.ok) return;
    const j = (await res.json()) as {
      items: { id: string; requestNumber: string; name: string; occasion: string }[];
    };
    setBespokeHits(j.items.slice(0, 8));
  };

  const selectBespoke = async (id: string) => {
    const res = await fetch(`/api/admin/bespoke/${id}`);
    if (!res.ok) {
      toast.error("Could not load bespoke");
      return;
    }
    const bespoke = (await res.json()) as {
      id: string;
      requestNumber: string;
      name: string;
      email: string;
      phone: string;
      country: string | null;
      occasion: string;
    };
    setBespokeRequestId(bespoke.id);
    setBespokeLabel(`${bespoke.requestNumber} · ${bespoke.name}`);
    setClientName(bespoke.name);
    setClientEmail(bespoke.email);
    setClientPhone(bespoke.phone);
    setClientCountry(bespoke.country ?? "Nigeria");
    setBespokeHits([]);
  };

  const save = async (sendNow: boolean): Promise<boolean> => {
    const synced = syncLineItemAmounts(lineItems).filter((l) => l.description.trim().length > 0);
    if (!synced.length) {
      toast.error("Add at least one line item with a description");
      return false;
    }
    if (!clientName.trim() || !clientEmail.trim()) {
      toast.error("Client name and email are required");
      return false;
    }
    const body = {
      bespokeRequestId,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      clientPhone: clientPhone || null,
      clientAddress: clientAddress || null,
      clientCity: clientCity || null,
      clientCountry,
      clientInstagram: clientInstagram || null,
      currency,
      lineItems: synced.map((l) => ({
        id: l.id,
        description: l.description,
        details: l.details,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      discountType: discountOn ? discountType : null,
      discountValue: discountOn ? discountValue : 0,
      vatEnabled: vatOn,
      vatPercent: vatOn ? vatPercent : 0,
      paymentTerms: paymentTerms || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      clientNote: clientNote || null,
      notes: notes || null,
      showVat,
      showRcNumber: showRc,
      depositPercent: depositPct,
    };

    try {
      if (mode === "create") {
        const res = await fetch("/api/admin/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("create failed");
        const created = (await res.json()) as { id: string };
        toast.success("Invoice created");
        if (sendNow) {
          await fetch(`/api/admin/invoices/${created.id}/send`, { method: "POST" });
          toast.success("Sent to client");
        }
        router.push(`/admin/invoices/${created.id}/edit`);
        return true;
      }
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("patch failed");
      toast.success("Saved");
      if (sendNow) {
        await fetch(`/api/admin/invoices/${invoiceId}/send`, { method: "POST" });
        toast.success("Sent to client");
      }
      void loadInvoice();
      return true;
    } catch {
      toast.error("Save failed");
      return false;
    }
  };

  if (loading) {
    return <p className="font-body text-sm text-[#6B6B68]">Loading…</p>;
  }

  const base = getPublicAppUrl().replace(/\/+$/, "");

  return (
    <div>
      <Link href="/admin/invoices" className="font-body text-[11px] uppercase text-[#6B6B68] hover:text-ink">
        ← Invoices
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-2xl text-ink">
          {mode === "create" ? "New invoice" : `Edit invoice ${invoiceNumber}`}
        </h1>
        {mode === "edit" && publicToken ? (
          <div className="flex flex-wrap gap-2">
            <a
              href={`${base}/invoice/${publicToken}`}
              target="_blank"
              rel="noreferrer"
              className="border border-[#EBEBEA] px-4 py-2 font-body text-[11px] uppercase"
            >
              Preview
            </a>
            <button
              type="button"
              className="border border-[#EBEBEA] px-4 py-2 font-body text-[11px] uppercase"
              onClick={() => window.open(`/api/admin/invoices/${invoiceId}/pdf`, "_blank")}
            >
              Download PDF
            </button>
            <button
              type="button"
              className="bg-[#37392d] px-4 py-2 font-body text-[11px] uppercase text-white"
              onClick={async () => {
                const ok = await save(false);
                if (!ok) return;
                const res = await fetch(`/api/admin/invoices/${invoiceId}/send`, { method: "POST" });
                if (!res.ok) toast.error("Send failed");
                else toast.success("Sent to client");
              }}
            >
              Send to client
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section className="border border-[#EBEBEA] bg-canvas p-5">
            <h2 className="font-body text-[11px] font-medium uppercase text-[#6B6B68]">Link to bespoke (optional)</h2>
            <input
              className="mt-3 w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm"
              placeholder="Search #BQ-… or client name"
              onChange={(e) => void searchBespoke(e.target.value)}
            />
            {bespokeHits.length > 0 ? (
              <ul className="mt-2 border border-[#EBEBEA] bg-white">
                {bespokeHits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left font-body text-xs hover:bg-[#FAFAF8]"
                      onClick={() => void selectBespoke(h.id)}
                    >
                      {h.requestNumber} · {h.name} · {h.occasion}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {bespokeLabel ? <p className="mt-2 font-body text-xs text-olive">Linked: {bespokeLabel}</p> : null}
            <button
              type="button"
              className="mt-2 font-body text-[11px] text-olive underline"
              onClick={() => {
                setBespokeRequestId(null);
                setBespokeLabel("");
              }}
            >
              Clear bespoke link
            </button>
          </section>

          <section className="border border-[#EBEBEA] bg-canvas p-5">
            <h2 className="font-body text-[11px] font-medium uppercase text-[#6B6B68]">Client</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block font-body text-xs">
                Full name
                <input className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </label>
              <label className="block font-body text-xs">
                Email
                <input className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </label>
              <label className="block font-body text-xs">
                Phone
                <input className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
              </label>
              <label className="block font-body text-xs">
                City
                <input className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm" value={clientCity} onChange={(e) => setClientCity(e.target.value)} />
              </label>
              <label className="block font-body text-xs sm:col-span-2">
                Address
                <input className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
              </label>
              <label className="block font-body text-xs">
                Country
                <input className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm" value={clientCountry} onChange={(e) => setClientCountry(e.target.value)} />
              </label>
              <label className="block font-body text-xs">
                Instagram
                <input className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm" value={clientInstagram} onChange={(e) => setClientInstagram(e.target.value)} />
              </label>
            </div>
          </section>

          <section className="border border-[#EBEBEA] bg-canvas p-5">
            <h2 className="font-body text-[11px] font-medium uppercase text-[#6B6B68]">Invoice details</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {(["NGN", "USD", "GBP"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`border px-4 py-2 font-body text-xs ${currency === c ? "border-[#37392d] ring-1 ring-[#37392d]" : "border-[#EBEBEA]"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="mt-4 block font-body text-xs">
              Due date
              <input type="date" className="mt-1 border border-[#EBEBEA] px-3 py-2 text-sm" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label className="mt-4 block font-body text-xs">
              Payment terms
              <textarea className="mt-1 min-h-[80px] w-full border border-[#EBEBEA] px-3 py-2 text-sm" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            </label>
          </section>

          <section className="border border-[#EBEBEA] bg-canvas p-5">
            <h2 className="font-body text-[11px] font-medium uppercase text-[#6B6B68]">Line items</h2>
            <div className="mt-4 space-y-3">
              {lineItems.map((li) => (
                <div key={li.id} className="grid gap-2 border border-[#EBEBEA] bg-white p-3 sm:grid-cols-12">
                  <input
                    className="sm:col-span-4 border border-[#EBEBEA] px-2 py-1 text-sm"
                    placeholder="Description"
                    value={li.description}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLineItems((prev) => prev.map((x) => (x.id === li.id ? { ...x, description: v } : x)));
                    }}
                  />
                  <input
                    className="sm:col-span-3 border border-[#EBEBEA] px-2 py-1 text-sm"
                    placeholder="Details"
                    value={li.details ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLineItems((prev) => prev.map((x) => (x.id === li.id ? { ...x, details: v } : x)));
                    }}
                  />
                  <input
                    type="number"
                    className="sm:col-span-1 border border-[#EBEBEA] px-2 py-1 text-sm"
                    min={1}
                    value={li.quantity}
                    onChange={(e) => {
                      const q = Number(e.target.value);
                      setLineItems((prev) =>
                        prev.map((x) => (x.id === li.id ? { ...x, quantity: Number.isFinite(q) && q > 0 ? q : 1 } : x)),
                      );
                    }}
                  />
                  <input
                    type="number"
                    className="sm:col-span-2 border border-[#EBEBEA] px-2 py-1 text-sm"
                    min={0}
                    step="0.01"
                    value={li.unitPrice}
                    onChange={(e) => {
                      const p = Number(e.target.value);
                      setLineItems((prev) =>
                        prev.map((x) => (x.id === li.id ? { ...x, unitPrice: Number.isFinite(p) && p >= 0 ? p : 0 } : x)),
                      );
                    }}
                  />
                  <div className="sm:col-span-1 flex items-center font-body text-sm font-medium">
                    {formatInvoiceCurrency(li.quantity * li.unitPrice, cur)}
                  </div>
                  <button
                    type="button"
                    className="sm:col-span-1 text-xs text-red-700 underline"
                    disabled={lineItems.length <= 1}
                    onClick={() => setLineItems((prev) => prev.filter((x) => x.id !== li.id))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 font-body text-[11px] uppercase text-olive underline"
              onClick={() => setLineItems((prev) => [...prev, { id: nanoid(), description: "", quantity: 1, unitPrice: 0, amount: 0 }])}
            >
              + Add line item
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Gown design", "Fabric", "Beadwork", "Alterations", "Rush fee", "Fitting"].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="border border-[#EBEBEA] px-2 py-1 font-body text-[10px] uppercase"
                  onClick={() =>
                    setLineItems((prev) => [...prev, { id: nanoid(), description: chip, quantity: 1, unitPrice: 0, amount: 0 }])
                  }
                >
                  {chip}
                </button>
              ))}
            </div>
          </section>

          <section className="border border-[#EBEBEA] bg-canvas p-5 space-y-4">
            <label className="flex items-center gap-2 font-body text-sm">
              <input type="checkbox" checked={discountOn} onChange={(e) => setDiscountOn(e.target.checked)} className="accent-olive" />
              Apply discount
            </label>
            {discountOn ? (
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1 text-xs">
                  <input type="radio" checked={discountType === "PERCENTAGE"} onChange={() => setDiscountType("PERCENTAGE")} />
                  %
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="radio" checked={discountType === "FIXED"} onChange={() => setDiscountType("FIXED")} />
                  Fixed
                </label>
                <input
                  type="number"
                  className="border border-[#EBEBEA] px-2 py-1 text-sm"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                />
              </div>
            ) : null}
            <label className="flex items-center gap-2 font-body text-sm">
              <input type="checkbox" checked={vatOn} onChange={(e) => setVatOn(e.target.checked)} className="accent-olive" />
              Apply VAT
            </label>
            {vatOn ? (
              <input
                type="number"
                className="border border-[#EBEBEA] px-2 py-1 text-sm"
                value={vatPercent}
                onChange={(e) => setVatPercent(Number(e.target.value) || 0)}
              />
            ) : null}
            <div>
              <p className="font-body text-[11px] uppercase text-[#6B6B68]">Deposit %</p>
              <input
                type="number"
                className="mt-1 border border-[#EBEBEA] px-2 py-1 text-sm"
                min={0}
                max={100}
                value={depositPct}
                onChange={(e) => setDepositPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              />
            </div>
            <label className="flex items-center gap-2 font-body text-xs">
              <input type="checkbox" checked={showVat} onChange={(e) => setShowVat(e.target.checked)} className="accent-olive" />
              Show VAT on PDF
            </label>
            <label className="flex items-center gap-2 font-body text-xs">
              <input type="checkbox" checked={showRc} onChange={(e) => setShowRc(e.target.checked)} className="accent-olive" />
              Show RC on PDF
            </label>
          </section>

          <section className="border border-[#EBEBEA] bg-canvas p-5">
            <h2 className="font-body text-[11px] font-medium uppercase text-[#6B6B68]">Notes</h2>
            <label className="mt-3 block font-body text-xs">
              Client note
              <textarea className="mt-1 min-h-[72px] w-full border border-[#EBEBEA] px-3 py-2 text-sm" value={clientNote} onChange={(e) => setClientNote(e.target.value)} />
            </label>
            <label className="mt-3 block font-body text-xs">
              Internal notes
              <textarea className="mt-1 min-h-[72px] w-full border border-[#EBEBEA] px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </section>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="border border-[#EBEBEA] px-6 py-3 font-body text-xs uppercase" onClick={() => void save(false)}>
              Save draft
            </button>
            <button type="button" className="bg-[#37392d] px-6 py-3 font-body text-xs uppercase text-white" onClick={() => void save(true)}>
              Save &amp; send
            </button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 h-fit space-y-4">
          <div className="border border-[#EBEBEA] bg-[#FAFAF8] p-5">
            <div className="bg-[#37392d] px-3 py-2 font-body text-[10px] font-medium uppercase tracking-[0.15em] text-white">
              <div className="flex justify-between">
                <span>Prudential Atelier</span>
                <span>{invoiceNumber || "—"}</span>
              </div>
            </div>
            <p className="mt-3 font-body text-sm">{clientName}</p>
            <p className="text-xs text-[#6B6B68]">{clientEmail}</p>
            <p className="mt-2 font-body text-xs">Currency: {currency}</p>
            <div className="mt-4 space-y-1 border-t border-[#EBEBEA] pt-3 font-body text-xs">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatInvoiceCurrency(totals.subtotal, cur)}</span>
              </div>
              {totals.discountAmount > 0 ? (
                <div className="flex justify-between text-olive">
                  <span>Discount</span>
                  <span>-{formatInvoiceCurrency(totals.discountAmount, cur)}</span>
                </div>
              ) : null}
              {vatOn && totals.vatAmount > 0 ? (
                <div className="flex justify-between">
                  <span>VAT</span>
                  <span>{formatInvoiceCurrency(totals.vatAmount, cur)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatInvoiceCurrency(totals.total, cur)}</span>
              </div>
              {depositPct > 0 ? (
                <>
                  <div className="flex justify-between text-olive">
                    <span>Deposit</span>
                    <span>{formatInvoiceCurrency(totals.depositRequired, cur)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Balance due</span>
                    <span>{formatInvoiceCurrency(totals.balanceDue, cur)}</span>
                  </div>
                </>
              ) : null}
            </div>
            <p className="mt-3 font-body text-[11px] text-[#6B6B68]">Due: {dueDate || "—"}</p>
            <p className="mt-2 font-body text-[11px]">Status: {status}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
