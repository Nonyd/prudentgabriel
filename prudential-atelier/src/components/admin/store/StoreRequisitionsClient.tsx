"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { StoreSubnav } from "@/components/admin/store/StoreSubnav";

type ReqRow = {
  id: string;
  ref: string;
  status: string;
  client: string | null;
  orderRef: string | null;
  totalNGN: number;
  sameActorShortCircuit: boolean;
  raisedByName: string | null;
  createdAt: string;
};

export function StoreRequisitionsClient() {
  const search = useSearchParams();
  const fromCost = search.get("fromCost");
  const fundOnly = search.get("fund") === "1";
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [raising, setRaising] = useState(false);

  const load = useCallback(async () => {
    const q = fundOnly ? "?fund=1" : "";
    const res = await fetch(`/api/admin/store/requisitions${q}`);
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not load");
      return;
    }
    setRows(((await res.json()) as { items: ReqRow[] }).items);
  }, [fundOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const raiseFromCost = async () => {
    if (!fromCost) return;
    setRaising(true);
    const res = await fetch("/api/admin/store/requisitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ costOfProductionId: fromCost }),
    });
    const data = await res.json();
    setRaising(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not raise");
      return;
    }
    toast.success(`Raised ${data.item.ref}`);
    window.location.href = `/admin/store/requisitions/${data.item.id}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-text-light">Store</p>
        <h1 className="font-display text-2xl text-ink">{fundOnly ? "Awaiting funds" : "Requisitions"}</h1>
        <p className="mt-1 max-w-2xl font-sans text-sm text-text-mid">
          {fundOnly
            ? "Money to release — open a row to see every line before you fund."
            : "Stock check, accounts, funding, buy, receive. Each step is a record, not an email."}
        </p>
      </div>
      <StoreSubnav />
      <div className="flex flex-wrap gap-3 font-sans text-xs">
        <Link href="/admin/store/requisitions" className={!fundOnly ? "text-choc underline" : "text-text-mid"}>
          All
        </Link>
        <Link href="/admin/store/requisitions?fund=1" className={fundOnly ? "text-choc underline" : "text-text-mid"}>
          Awaiting funds
        </Link>
      </div>

      {fromCost ? (
        <div className="border border-sand bg-bg-card p-4">
          <p className="font-sans text-sm text-text-mid">Raise a requisition from the approved cost of production.</p>
          <Button type="button" className="mt-3" disabled={raising} onClick={() => void raiseFromCost()}>
            {raising ? "Raising…" : "Raise requisition"}
          </Button>
        </div>
      ) : null}

      {error ? <p className="font-sans text-sm text-danger">{error}</p> : null}

      <section className="border border-sand bg-bg-card p-6">
        {rows.length === 0 ? (
          <p className="font-sans text-sm text-text-mid">No requisitions here.</p>
        ) : (
          <ul className="divide-y divide-sand font-sans text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/admin/store/requisitions/${r.id}`} className="font-medium text-choc underline">
                    {r.ref}
                  </Link>
                  <p className="text-xs text-text-light">
                    {r.status} · {r.client ?? "—"} {r.orderRef ? `· ${r.orderRef}` : ""} · ₦
                    {r.totalNGN.toLocaleString("en-NG")}
                    {r.sameActorShortCircuit ? " · same person on consecutive steps" : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/store/requisitions/${r.id}/print`}
                  className="text-[11px] uppercase tracking-wide text-text-mid underline"
                >
                  Print
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
