"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { AlterationPricing } from "@prisma/client";
import { Button } from "@/components/ui/Button";

type Row = {
  id: string;
  reason: string;
  status: string;
  description: string;
  pricingDefault?: string | null;
  order: { id: string; orderRef: string; clientName: string; deliveredAt: string | null };
};

export function AlterationsAdminClient() {
  const [items, setItems] = useState<Row[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pricingDefault, setPricingDefault] = useState<AlterationPricing>("FREE");
  const [decision, setDecision] = useState<AlterationPricing>("FREE");
  const [overrideReason, setOverrideReason] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("15000");
  const [quoteAmount, setQuoteAmount] = useState("25000");

  async function load() {
    const res = await fetch("/api/admin/alterations?status=REQUESTED");
    if (res.ok) {
      const data = (await res.json()) as { items: Row[] };
      setItems(data.items);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function openTriage(id: string) {
    setSelected(id);
    const res = await fetch(`/api/admin/alterations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    const d = data.pricingDefault as AlterationPricing;
    setPricingDefault(d);
    setDecision(d);
  }

  async function triage(action: "ACCEPT" | "DECLINE") {
    if (!selected) return;
    const body: Record<string, unknown> = {
      action,
      pricingDecision: decision,
      pricingOverrideReason: decision !== pricingDefault ? overrideReason : null,
    };
    if (action === "ACCEPT" && decision === "FREE") {
      body.complimentaryEstimatedValue = Number(estimatedValue);
    }
    if (action === "ACCEPT" && decision === "CHARGEABLE") {
      const amt = Number(quoteAmount);
      body.quoteLineItems = [
        {
          description: "Post-delivery alteration",
          quantity: 1,
          unitPrice: amt,
          total: amt,
        },
      ];
    }
    if (action === "DECLINE") body.declineReason = "Declined by atelier";

    const res = await fetch(`/api/admin/alterations/${selected}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Failed");
      return;
    }
    toast.success(action === "ACCEPT" ? "Accepted" : "Declined");
    if (data.quotationId) {
      toast.success(`Quotation created`);
    }
    setSelected(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Alteration requests</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Post-delivery triage. Warranty defaults apply; override with a reason.
        </p>
      </div>
      <ul className="divide-y divide-sand/50 border border-sand/40">
        {items.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link href={`/admin/bespoke/${row.order.id}`} className="font-sans text-sm font-medium text-nut">
                {row.order.orderRef}
              </Link>
              <p className="font-sans text-xs text-text-mid">
                {row.order.clientName} · {row.reason} · {row.description.slice(0, 80)}
              </p>
            </div>
            <Button size="sm" onClick={() => void openTriage(row.id)}>
              Triage
            </Button>
          </li>
        ))}
        {!items.length ? (
          <li className="px-4 py-8 text-center font-sans text-sm text-text-light">No open requests</li>
        ) : null}
      </ul>

      {selected ? (
        <div className="rounded border border-nut/20 bg-ivory p-4">
          <p className="font-sans text-sm text-text-mid">
            Policy default: <strong>{pricingDefault}</strong>
          </p>
          <label className="mt-3 block font-sans text-xs uppercase text-nut">
            Decision
            <select
              className="mt-1 w-full border border-sand bg-white px-3 py-2 text-sm"
              value={decision}
              onChange={(e) => setDecision(e.target.value as AlterationPricing)}
            >
              <option value="FREE">Complimentary (free)</option>
              <option value="CHARGEABLE">Quote for it</option>
            </select>
          </label>
          {decision !== pricingDefault ? (
            <label className="mt-3 block font-sans text-xs uppercase text-nut">
              Override reason
              <input
                className="mt-1 w-full border border-sand bg-white px-3 py-2 text-sm"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </label>
          ) : null}
          {decision === "FREE" ? (
            <label className="mt-3 block font-sans text-xs uppercase text-nut">
              Estimated complimentary value (₦)
              <input
                type="number"
                className="mt-1 w-full border border-sand bg-white px-3 py-2 text-sm"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </label>
          ) : (
            <label className="mt-3 block font-sans text-xs uppercase text-nut">
              Quote amount (₦)
              <input
                type="number"
                className="mt-1 w-full border border-sand bg-white px-3 py-2 text-sm"
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value)}
              />
            </label>
          )}
          <div className="mt-4 flex gap-2">
            <Button onClick={() => void triage("ACCEPT")}>Accept</Button>
            <Button variant="ghost" onClick={() => void triage("DECLINE")}>
              Decline
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
