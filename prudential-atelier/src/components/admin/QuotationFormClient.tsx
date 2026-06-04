"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

function calcLineTotal(qty: number, price: number) {
  return Math.round(qty * price * 100) / 100;
}

export function QuotationFormClient() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [expiresAt, setExpiresAt] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
  const total = Math.max(0, Math.round((subtotal + tax - discount) * 100) / 100);

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/quotations"
          className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light hover:text-nut"
        >
          ← Quotations
        </Link>
        <h1 className="mt-2 font-display text-2xl text-ink">New Quotation</h1>
      </div>

      <div className="card-surface space-y-6 p-6">
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
                  {formatPrice(row.total, "NGN")}
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
            <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Tax (NGN)</span>
            <input
              type="number"
              min={0}
              value={tax}
              onChange={(e) => setTax(Number(e.target.value) || 0)}
              className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Discount (NGN)</span>
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
            Subtotal {formatPrice(subtotal, "NGN")} · Total{" "}
            <span className="font-semibold text-choc">{formatPrice(total, "NGN")}</span>
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
