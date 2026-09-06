"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FinanceAa0Note } from "@/components/admin/finance/FinanceAa0Note";
import type { LineTotals } from "@/lib/finance/classify";
import type { FinancePeriodKind } from "@/lib/finance/period";

type Payload = {
  range: { kind: string; label: string; prevLabel: string };
  current: { rtw: LineTotals; atelier: LineTotals; combined: LineTotals };
  previous: { rtw: LineTotals; atelier: LineTotals; combined: LineTotals } | null;
  outstanding: {
    oversellNGN: number;
    pointsNGN: number;
    points: number;
    rateNGN: number;
    asOf: string;
  };
  bestsellers: { name: string; quantity: number; salesNGN: number }[];
};

const KINDS: { id: FinancePeriodKind; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

function naira(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function Three({
  title,
  now,
  prev,
}: {
  title: string;
  now: LineTotals;
  prev: LineTotals | null;
}) {
  const cell = (label: string, value: number, was: number | null) => (
    <div>
      <p className="font-sans text-[10px] uppercase tracking-wider text-[#6B6B68]">{label}</p>
      <p className="mt-1 font-display text-2xl text-choc">{naira(value)}</p>
      {was != null ? (
        <p className="mt-1 font-sans text-xs text-[#6B6B68]">Before: {naira(was)}</p>
      ) : null}
    </div>
  );
  return (
    <div className="glass-opaque p-5">
      <h2 className="font-display text-lg text-choc">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {cell("Sales value", now.salesNGN, prev?.salesNGN ?? null)}
        {cell("Cash received", now.cashNGN, prev?.cashNGN ?? null)}
        {cell("Outstanding", now.liabilityNGN, prev?.liabilityNGN ?? null)}
      </div>
      {now.pointsNGN > 0 || now.shippingCollectedNGN > 0 ? (
        <p className="mt-4 font-sans text-xs text-[#6B6B68]">
          Points redeemed {naira(now.pointsNGN)} · Shipping collected {naira(now.shippingCollectedNGN)} (not in sales)
        </p>
      ) : null}
    </div>
  );
}

export function HowWeAreDoingClient() {
  const [kind, setKind] = useState<FinancePeriodKind>("month");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?kind=${kind}`);
      if (res.ok) setData((await res.json()) as Payload);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-heading-pill glass-1 glass-pill font-display text-3xl text-choc">How we are doing</h1>
        <p className="mt-1 font-sans text-sm text-[#6B6B68]">
          Ready-to-wear and Atelier, side by side. Detail lives in{" "}
          <Link href="/admin/reports/ledger" className="text-choc underline">
            Accounts
          </Link>
          .
        </p>
      </div>
      <FinanceAa0Note />
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={`admin-chip glass-1 glass-pill min-h-[44px] font-sans text-xs uppercase tracking-wider ${
              kind === k.id ? "border-[var(--glass-edge-bright)] text-choc" : "text-[#6B6B68]"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="font-sans text-sm text-[#6B6B68]">Loading…</p>
      ) : !data ? (
        <p className="font-sans text-sm text-[#6B6B68]">Could not load this period.</p>
      ) : (
        <>
          <p className="font-sans text-xs uppercase tracking-wider text-[#6B6B68]">
            {data.range.label}
            {data.range.prevLabel ? ` · previous ${data.range.prevLabel}` : ""}
          </p>
          <Three title="Together" now={data.current.combined} prev={data.previous?.combined ?? null} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Three title="Ready-to-wear" now={data.current.rtw} prev={data.previous?.rtw ?? null} />
            <Three title="Atelier" now={data.current.atelier} prev={data.previous?.atelier ?? null} />
          </div>
          <div className="glass-opaque p-5">
            <h2 className="font-display text-lg text-choc">Best-selling pieces</h2>
            {data.bestsellers.length === 0 ? (
              <p className="mt-3 font-sans text-sm text-[#6B6B68]">Nothing sold in this stretch.</p>
            ) : (
              <ul className="mt-3 divide-y divide-sand">
                {data.bestsellers.map((b) => (
                  <li key={b.name} className="flex justify-between py-2 font-sans text-sm">
                    <span>{b.name}</span>
                    <span className="text-[#6B6B68]">
                      {b.quantity} · {naira(b.salesNGN)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="font-sans text-xs text-[#6B6B68]">
            Points still owing: {naira(data.outstanding.pointsNGN)} ({data.outstanding.points.toLocaleString()} points ×{" "}
            {naira(data.outstanding.rateNGN)} each) as of {new Date(data.outstanding.asOf).toLocaleString("en-GB")}.
            Paid-and-cancelled waiting for a refund: {naira(data.outstanding.oversellNGN)}.
          </p>
        </>
      )}
    </div>
  );
}
