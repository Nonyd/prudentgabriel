"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { STORE_FIELD, StoreSubnav } from "@/components/admin/store/StoreSubnav";
import { formatQty } from "@/lib/store/qty";

type Person = { id: string; name: string };
type Commission = { id: string; label: string };
type ShopOrder = { id: string; label: string };
type Item = { id: string; name: string; unit: string; onHand: number };
type Movement = {
  id: string;
  itemName: string;
  unit: string;
  delta: number;
  reason: string;
  ref: string | null;
  createdAt: string;
  takenByName: string | null;
  approvedByName: string | null;
  receivedByName: string | null;
  client: string | null;
  orderRef: string | null;
  outstanding: number | null;
  note: string | null;
};

type Line = { itemId: string; quantity: string };

export function StoreBookClient() {
  const [people, setPeople] = useState<Person[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [issues, setIssues] = useState<Movement[]>([]);
  const [recent, setRecent] = useState<Movement[]>([]);
  const [takenById, setTakenById] = useState("");
  const [approvedById, setApprovedById] = useState("");
  const [bespokeOrderId, setBespokeOrderId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ itemId: "", quantity: "" }]);
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [receivedById, setReceivedById] = useState("");
  const [receipt, setReceipt] = useState({ itemId: "", quantity: "", note: "" });

  const load = useCallback(async () => {
    const [look, itemRes, issueRes, moveRes] = await Promise.all([
      fetch("/api/admin/store/lookups"),
      fetch("/api/admin/store/items"),
      fetch("/api/admin/store/issues?outstanding=1"),
      fetch("/api/admin/store/movements?take=40"),
    ]);
    if (look.ok) {
      const data = (await look.json()) as {
        people: Person[];
        commissions: Commission[];
        shopOrders: ShopOrder[];
      };
      setPeople(data.people);
      setCommissions(data.commissions);
      setShopOrders(data.shopOrders);
      setTakenById((id) => id || data.people[0]?.id || "");
      setApprovedById((id) => id || data.people[0]?.id || "");
      setReceivedById((id) => id || data.people[0]?.id || "");
    }
    if (itemRes.ok) {
      const data = (await itemRes.json()) as { items: Item[] };
      setItems(data.items);
    }
    if (issueRes.ok) {
      const data = (await issueRes.json()) as { items: Movement[] };
      setIssues(data.items);
    }
    if (moveRes.ok) {
      const data = (await moveRes.json()) as { items: Movement[] };
      setRecent(data.items);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitIssue = async () => {
    const res = await fetch("/api/admin/store/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        takenById,
        approvedById,
        bespokeOrderId: bespokeOrderId || null,
        orderId: orderId || null,
        note: note || null,
        lines: lines.filter((l) => l.itemId && l.quantity),
      }),
    });
    const data = (await res.json()) as { error?: string; ref?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Could not issue");
      return;
    }
    toast.success(`Issued ${data.ref}`);
    setLines([{ itemId: "", quantity: "" }]);
    setNote("");
    await load();
    if (data.ref) window.open(`/admin/store/issues/${encodeURIComponent(data.ref)}/print`, "_blank");
  };

  const submitReturn = async (issueId: string) => {
    const quantity = returnQty[issueId];
    const res = await fetch("/api/admin/store/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueId, quantity, receivedById }),
    });
    if (!res.ok) {
      toast.error((await res.json()).error ?? "Could not record return");
      return;
    }
    toast.success("Return recorded");
    setReturnQty((m) => ({ ...m, [issueId]: "" }));
    await load();
  };

  const submitReceipt = async () => {
    const res = await fetch("/api/admin/store/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "RECEIPT",
        itemId: receipt.itemId,
        quantity: receipt.quantity,
        note: receipt.note || null,
      }),
    });
    if (!res.ok) {
      toast.error((await res.json()).error ?? "Could not record receipt");
      return;
    }
    toast.success("Receipt recorded");
    setReceipt({ itemId: "", quantity: "", note: "" });
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-text-light">Store</p>
        <h1 className="font-display text-2xl text-ink">Issue book</h1>
        <p className="mt-1 max-w-2xl font-sans text-sm text-text-mid">
          The booklet: item, quantity, who is taking it, which client order, and the supervisor who approved. Offcuts
          come back against the same issue.
        </p>
      </div>
      <StoreSubnav />

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-lg text-ink">Issue</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block font-sans text-xs text-text-mid">
            Who is taking it
            <select className={`${STORE_FIELD} mt-1`} value={takenById} onChange={(e) => setTakenById(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-sans text-xs text-text-mid">
            Supervisor who approved
            <select
              className={`${STORE_FIELD} mt-1`}
              value={approvedById}
              onChange={(e) => setApprovedById(e.target.value)}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-sans text-xs text-text-mid">
            Commission
            <select
              className={`${STORE_FIELD} mt-1`}
              value={bespokeOrderId}
              onChange={(e) => setBespokeOrderId(e.target.value)}
            >
              <option value="">—</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-sans text-xs text-text-mid">
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
        </div>
        <div className="mt-4 space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_8rem]">
              <select
                className={STORE_FIELD}
                value={line.itemId}
                onChange={(e) =>
                  setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, itemId: e.target.value } : r)))
                }
              >
                <option value="">Material…</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({formatQty(item.onHand, item.unit)})
                  </option>
                ))}
              </select>
              <input
                className={STORE_FIELD}
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) =>
                  setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, quantity: e.target.value } : r)))
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="font-sans text-xs text-choc underline"
            onClick={() => setLines((rows) => [...rows, { itemId: "", quantity: "" }])}
          >
            Add line
          </button>
        </div>
        <input
          className={`${STORE_FIELD} mt-3`}
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="mt-4">
          <Button size="sm" onClick={() => void submitIssue()}>
            Issue and print slip
          </Button>
        </div>
      </section>

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-lg text-ink">Open issues — returns</h2>
        <label className="mt-3 block max-w-sm font-sans text-xs text-text-mid">
          Receiver
          <select
            className={`${STORE_FIELD} mt-1`}
            value={receivedById}
            onChange={(e) => setReceivedById(e.target.value)}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {issues.length === 0 ? (
          <p className="mt-3 font-sans text-sm text-text-mid">Nothing outstanding to come back.</p>
        ) : (
          <ul className="mt-3 divide-y divide-sand font-sans text-sm">
            {issues.map((row) => (
              <li key={row.id} className="flex flex-wrap items-end justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-ink">
                    {row.itemName} · {formatQty(row.outstanding ?? 0, row.unit)} out
                  </p>
                  <p className="text-xs text-text-light">
                    {row.client ?? "No client"} · taken by {row.takenByName} · approved {row.approvedByName}
                    {row.ref ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/admin/store/issues/${encodeURIComponent(row.ref)}/print`} className="text-choc underline">
                          {row.ref}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    className={`${STORE_FIELD} w-24`}
                    placeholder="Qty"
                    value={returnQty[row.id] ?? ""}
                    onChange={(e) => setReturnQty((m) => ({ ...m, [row.id]: e.target.value }))}
                  />
                  <Button size="sm" variant="secondary" onClick={() => void submitReturn(row.id)}>
                    Return
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-lg text-ink">Receipt</h2>
        <p className="mt-1 font-sans text-sm text-text-mid">Supervisor has counted an arrival. Log it onto the shelf.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_8rem]">
          <select
            className={STORE_FIELD}
            value={receipt.itemId}
            onChange={(e) => setReceipt((r) => ({ ...r, itemId: e.target.value }))}
          >
            <option value="">Item…</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            className={STORE_FIELD}
            placeholder="Qty"
            value={receipt.quantity}
            onChange={(e) => setReceipt((r) => ({ ...r, quantity: e.target.value }))}
          />
        </div>
        <input
          className={`${STORE_FIELD} mt-2`}
          placeholder="Note"
          value={receipt.note}
          onChange={(e) => setReceipt((r) => ({ ...r, note: e.target.value }))}
        />
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={() => void submitReceipt()}>
            Record receipt
          </Button>
        </div>
      </section>

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-lg text-ink">Recent movements</h2>
        <ul className="mt-3 divide-y divide-sand font-sans text-sm">
          {recent.map((m) => (
            <li key={m.id} className="py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-light">{m.reason}</span>{" "}
              {formatQty(m.delta, m.unit)} {m.itemName}
              {m.note ? <span className="text-text-mid"> — {m.note}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
