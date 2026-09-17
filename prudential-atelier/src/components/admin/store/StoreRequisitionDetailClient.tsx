"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { STORE_FIELD, StoreSubnav } from "@/components/admin/store/StoreSubnav";

type Line = {
  id: string;
  itemId: string | null;
  name: string | null;
  quantity: number;
  unit: string;
  estimatedCostNGN: number;
  confirmedQuantity: number | null;
  coveredByStock: boolean;
  shortfallQuantity: number | null;
};

type Event = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorName: string | null;
  note: string | null;
  sameActorAsPrevious: boolean;
  createdAt: string;
};

type Detail = {
  id: string;
  ref: string;
  status: string;
  statusLabel: string;
  nextStatus: string | null;
  notes: string | null;
  declineReason: string | null;
  sameActorShortCircuit: boolean;
  raisedByName: string | null;
  client: string | null;
  orderRef: string | null;
  tailorCostNGN: number | null;
  stockCheckedByName: string | null;
  totalNGN: number;
  lines: Line[];
  events: Event[];
};

type Coverage = { id: string; onHand: number; covers: boolean; label: string };

const ADVANCE_LABEL: Record<string, string> = {
  STOCK_CHECKED: "Confirm stock check",
  WITH_ACCOUNTS: "Send to accounts",
  AWAITING_FUNDS: "Ready for funding",
  FUNDED: "Release funds",
  PURCHASED: "Record purchase",
  RECEIVED: "Confirm receipt",
  CLOSED: "Close requisition",
};

export function StoreRequisitionDetailClient({ id }: { id: string }) {
  const [item, setItem] = useState<Detail | null>(null);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [covered, setCovered] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const [declineReason, setDeclineReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/store/requisitions/${id}`);
    if (!res.ok) {
      setError((await res.json()).error ?? "Not found");
      return;
    }
    const data = (await res.json()) as { item: Detail; coverage?: Coverage[] };
    setItem(data.item);
    setCoverage(data.coverage ?? []);
    const nextCovered: Record<string, boolean> = {};
    const nextConfirmed: Record<string, string> = {};
    for (const line of data.item.lines) {
      nextCovered[line.id] = line.coveredByStock;
      nextConfirmed[line.id] =
        line.confirmedQuantity != null ? String(line.confirmedQuantity) : String(line.quantity);
    }
    for (const c of data.coverage ?? []) {
      if (c.covers) nextCovered[c.id] = true;
    }
    setCovered(nextCovered);
    setConfirmed(nextConfirmed);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = async () => {
    if (!item?.nextStatus) return;
    setBusy(true);
    const lines =
      item.nextStatus === "STOCK_CHECKED"
        ? item.lines.map((l) => ({ id: l.id, coveredByStock: Boolean(covered[l.id]) }))
        : item.nextStatus === "RECEIVED"
          ? item.lines
              .filter((l) => !l.coveredByStock)
              .map((l) => ({
                id: l.id,
                confirmedQuantity: Number(confirmed[l.id] ?? l.quantity),
              }))
          : undefined;
    const res = await fetch(`/api/admin/store/requisitions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance", lines }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not advance");
      return;
    }
    toast.success(item.nextStatus === "FUNDED" ? "Funds released" : "Advanced");
    setItem(data.item);
    void load();
  };

  const decline = async () => {
    if (!declineReason.trim()) {
      toast.error("A decline needs a reason");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/store/requisitions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline", reason: declineReason }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not decline");
      return;
    }
    toast.success("Declined — order entered fabric-unavailable queue");
    setItem(data.item);
  };

  if (error) {
    return (
      <div className="space-y-4">
        <StoreSubnav />
        <p className="font-sans text-sm text-danger">{error}</p>
      </div>
    );
  }
  if (!item) {
    return (
      <div className="space-y-4">
        <StoreSubnav />
        <p className="font-sans text-sm text-text-mid">Loading…</p>
      </div>
    );
  }

  const awaitingFunds = item.status === "AWAITING_FUNDS";
  const buyLines = item.lines.filter((l) => !l.coveredByStock);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-text-light">Requisition</p>
          <h1 className="font-display text-2xl text-ink">{item.ref}</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">
            {item.statusLabel}
            {item.sameActorShortCircuit ? " · raised and approved by the same person on consecutive steps" : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/admin/store/requisitions/${id}/print`} className="font-sans text-xs text-choc underline">
            Print
          </Link>
          <Link href="/admin/store/requisitions" className="font-sans text-xs text-text-mid underline">
            Back
          </Link>
        </div>
      </div>
      <StoreSubnav />

      {/* AQ13 — funding screen: total, lines, client, stock-check approver before the button */}
      {awaitingFunds ? (
        <section className="border-2 border-nut bg-bg-card p-6" data-testid="funding-screen">
          <h2 className="font-display text-xl text-ink">Release funds</h2>
          <p className="mt-1 font-sans text-sm text-text-mid">
            Read this before the button. Nobody should release money and then go looking for what it was for.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 font-sans text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-text-light">Client / order</dt>
              <dd className="font-medium text-ink">
                {item.client ?? "—"}
                {item.orderRef ? ` · ${item.orderRef}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-text-light">Stock check approved by</dt>
              <dd className="font-medium text-ink">{item.stockCheckedByName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-text-light">Total to fund</dt>
              <dd className="font-display text-2xl text-ink">₦{item.totalNGN.toLocaleString("en-NG")}</dd>
            </div>
            {item.tailorCostNGN != null ? (
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-text-light">Tailor figure (not funded here)</dt>
                <dd>₦{item.tailorCostNGN.toLocaleString("en-NG")}</dd>
              </div>
            ) : null}
          </dl>
          <table className="mt-6 w-full border-collapse font-sans text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-[10px] uppercase tracking-wide text-text-light">
                <th className="py-2">Material</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Est. ₦</th>
              </tr>
            </thead>
            <tbody>
              {buyLines.map((l) => (
                <tr key={l.id} className="border-b border-sand">
                  <td className="py-2">{l.name}</td>
                  <td className="py-2 text-right tabular-nums">
                    {l.quantity} {l.unit}
                  </td>
                  <td className="py-2 text-right tabular-nums">{l.estimatedCostNGN.toLocaleString("en-NG")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {item.sameActorShortCircuit ? (
            <p className="mt-4 border border-sand bg-bg-card/80 px-3 py-2 font-sans text-xs text-text-mid">
              Raised and approved by the same person on consecutive steps — recorded plainly on this slip.
            </p>
          ) : null}
          <div className="mt-6">
            <Button type="button" disabled={busy} onClick={() => void advance()}>
              {busy ? "Working…" : "Release funds"}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-lg text-ink">Lines</h2>
        <table className="mt-3 w-full border-collapse font-sans text-sm">
          <thead>
            <tr className="border-b border-sand text-left text-[10px] uppercase tracking-wide text-text-light">
              <th className="py-2">Material</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Est. ₦</th>
              {item.status === "RAISED" ? <th className="py-2">On shelf</th> : null}
              {item.nextStatus === "RECEIVED" ? <th className="py-2 text-right">Confirmed</th> : null}
            </tr>
          </thead>
          <tbody>
            {item.lines.map((l) => {
              const cov = coverage.find((c) => c.id === l.id);
              return (
                <tr key={l.id} className="border-b border-sand">
                  <td className="py-2">
                    {l.name}
                    {l.coveredByStock ? (
                      <span className="ml-2 text-[10px] uppercase text-text-light">covered by stock</span>
                    ) : null}
                    {l.shortfallQuantity != null && l.shortfallQuantity > 0 ? (
                      <span className="ml-2 text-[10px] uppercase text-[#C45E0A]">
                        short {l.shortfallQuantity}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {l.quantity} {l.unit}
                  </td>
                  <td className="py-2 text-right tabular-nums">{l.estimatedCostNGN.toLocaleString("en-NG")}</td>
                  {item.status === "RAISED" ? (
                    <td className="py-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={Boolean(covered[l.id])}
                          onChange={(e) => setCovered({ ...covered, [l.id]: e.target.checked })}
                        />
                        {cov ? `have ${cov.onHand}` : "drop out"}
                      </label>
                    </td>
                  ) : null}
                  {item.nextStatus === "RECEIVED" && !l.coveredByStock ? (
                    <td className="py-2 text-right">
                      <input
                        className={`${STORE_FIELD} w-24 text-right`}
                        value={confirmed[l.id] ?? ""}
                        onChange={(e) => setConfirmed({ ...confirmed, [l.id]: e.target.value })}
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {item.nextStatus && !awaitingFunds ? (
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={busy} onClick={() => void advance()}>
            {busy ? "Working…" : ADVANCE_LABEL[item.nextStatus] ?? `Advance to ${item.nextStatus}`}
          </Button>
        </div>
      ) : null}

      {item.status !== "CLOSED" && item.status !== "DECLINED" ? (
        <section className="border border-sand bg-bg-card p-6">
          <h2 className="font-display text-lg text-ink">Decline</h2>
          <p className="mt-1 font-sans text-sm text-text-mid">
            Sends the linked shop order into the fabric-unavailable queue and starts the 48-hour clock.
          </p>
          <textarea
            className={`${STORE_FIELD} mt-3 min-h-[80px]`}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Reason"
          />
          <Button type="button" variant="secondary" className="mt-3" disabled={busy} onClick={() => void decline()}>
            Decline with reason
          </Button>
        </section>
      ) : null}

      {item.declineReason ? (
        <p className="font-sans text-sm text-danger">Declined: {item.declineReason}</p>
      ) : null}

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-lg text-ink">Trail</h2>
        <ul className="mt-3 divide-y divide-sand font-sans text-sm">
          {item.events.map((e) => (
            <li key={e.id} className="py-2">
              <span className="font-medium">
                {e.fromStatus ?? "—"} → {e.toStatus}
              </span>
              <span className="text-text-mid"> · {e.actorName}</span>
              {e.sameActorAsPrevious ? (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-[#C45E0A]">same person as previous</span>
              ) : null}
              {e.note ? <p className="text-xs text-text-light">{e.note}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
