"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { STORE_FIELD, StoreSubnav } from "@/components/admin/store/StoreSubnav";

type LineDraft = {
  itemId: string;
  freeText: string;
  quantity: string;
  unit: string;
  estimatedCostNGN: string;
};

type CostRow = {
  id: string;
  status: "DRAFT" | "APPROVED";
  tailorCostNGN: number;
  materialsCostNGN: number;
  client: string | null;
  orderRef: string | null;
  draftedByName: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
};

type Item = { id: string; name: string; unit: string };
type Commission = { id: string; label: string };
type ShopOrder = { id: string; label: string };

export function StoreCostsClient() {
  const [rows, setRows] = useState<CostRow[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bespokeOrderId, setBespokeOrderId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [tailorCostNGN, setTailorCostNGN] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { itemId: "", freeText: "", quantity: "", unit: "yard", estimatedCostNGN: "" },
  ]);

  const load = useCallback(async () => {
    const [costRes, itemRes, look] = await Promise.all([
      fetch("/api/admin/store/costs"),
      fetch("/api/admin/store/items"),
      fetch("/api/admin/store/lookups"),
    ]);
    if (!costRes.ok) {
      setError((await costRes.json()).error ?? "Could not load");
      return;
    }
    setRows(((await costRes.json()) as { items: CostRow[] }).items);
    if (itemRes.ok) setItems(((await itemRes.json()) as { items: Item[] }).items);
    if (look.ok) {
      const data = (await look.json()) as { commissions: Commission[]; shopOrders: ShopOrder[] };
      setCommissions(data.commissions);
      setShopOrders(data.shopOrders);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const res = await fetch("/api/admin/store/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bespokeOrderId: bespokeOrderId || null,
        orderId: orderId || null,
        tailorCostNGN,
        notes: notes || null,
        lines: lines
          .filter((l) => l.quantity && (l.itemId || l.freeText))
          .map((l) => ({
            itemId: l.itemId || null,
            freeText: l.freeText || null,
            quantity: l.quantity,
            unit: l.unit || "yard",
            estimatedCostNGN: l.estimatedCostNGN || 0,
          })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not save");
      return;
    }
    toast.success("Draft saved");
    setTailorCostNGN("");
    setNotes("");
    setLines([{ itemId: "", freeText: "", quantity: "", unit: "yard", estimatedCostNGN: "" }]);
    void load();
  };

  const approve = async (id: string) => {
    const res = await fetch(`/api/admin/store/costs/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not approve");
      return;
    }
    toast.success("Approved");
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-text-light">Store</p>
        <h1 className="font-display text-2xl text-ink">Cost of production</h1>
        <p className="mt-1 max-w-2xl font-sans text-sm text-text-mid">
          Tailor figure and materials for a paid order — not payroll. Approve before raising a requisition.
        </p>
      </div>
      <StoreSubnav />
      {error ? <p className="font-sans text-sm text-danger">{error}</p> : null}

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-lg text-ink">New draft</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block font-sans text-[11px] uppercase tracking-wide text-text-light">
            Commission
            <select className={`${STORE_FIELD} mt-1`} value={bespokeOrderId} onChange={(e) => setBespokeOrderId(e.target.value)}>
              <option value="">—</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-sans text-[11px] uppercase tracking-wide text-text-light">
            Shop order
            <select className={`${STORE_FIELD} mt-1`} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">—</option>
              {shopOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-sans text-[11px] uppercase tracking-wide text-text-light">
            Tailor cost (₦)
            <input className={`${STORE_FIELD} mt-1`} value={tailorCostNGN} onChange={(e) => setTailorCostNGN(e.target.value)} />
          </label>
          <label className="block font-sans text-[11px] uppercase tracking-wide text-text-light">
            Notes
            <input className={`${STORE_FIELD} mt-1`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        <div className="mt-4 space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-5">
              <select
                className={STORE_FIELD}
                value={line.itemId}
                onChange={(e) => {
                  const next = [...lines];
                  const item = items.find((it) => it.id === e.target.value);
                  next[i] = { ...line, itemId: e.target.value, unit: item?.unit || line.unit };
                  setLines(next);
                }}
              >
                <option value="">Store item…</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
              <input
                className={STORE_FIELD}
                placeholder="Or free text"
                value={line.freeText}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...line, freeText: e.target.value };
                  setLines(next);
                }}
              />
              <input
                className={STORE_FIELD}
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...line, quantity: e.target.value };
                  setLines(next);
                }}
              />
              <input
                className={STORE_FIELD}
                placeholder="Unit"
                value={line.unit}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...line, unit: e.target.value };
                  setLines(next);
                }}
              />
              <input
                className={STORE_FIELD}
                placeholder="Est. ₦"
                value={line.estimatedCostNGN}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...line, estimatedCostNGN: e.target.value };
                  setLines(next);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="font-sans text-xs text-choc underline"
            onClick={() =>
              setLines([...lines, { itemId: "", freeText: "", quantity: "", unit: "yard", estimatedCostNGN: "" }])
            }
          >
            Add line
          </button>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={() => void save()}>
            Save draft
          </Button>
        </div>
      </section>

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-lg text-ink">Recent</h2>
        {rows.length === 0 ? (
          <p className="mt-3 font-sans text-sm text-text-mid">No costs yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-sand font-sans text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-ink">
                    {r.client ?? "—"} {r.orderRef ? `· ${r.orderRef}` : ""}
                  </p>
                  <p className="text-xs text-text-light">
                    {r.status} · tailor ₦{r.tailorCostNGN.toLocaleString("en-NG")} · materials ₦
                    {r.materialsCostNGN.toLocaleString("en-NG")}
                    {r.approvedByName ? ` · approved by ${r.approvedByName}` : ` · drafted by ${r.draftedByName}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.status === "DRAFT" ? (
                    <Button type="button" variant="secondary" onClick={() => void approve(r.id)}>
                      Approve
                    </Button>
                  ) : (
                    <Link href={`/admin/store/requisitions?fromCost=${r.id}`} className="font-sans text-xs text-choc underline">
                      Raise requisition
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
