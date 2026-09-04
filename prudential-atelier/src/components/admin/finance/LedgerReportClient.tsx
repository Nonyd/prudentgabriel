"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FinanceAa0Note } from "@/components/admin/finance/FinanceAa0Note";
import type { ClassifiedLine, FinanceLine, LineTotals } from "@/lib/finance/classify";

type Report = {
  from: string;
  to: string;
  lines: ClassifiedLine[];
  rtw: LineTotals;
  atelier: LineTotals;
  combined: LineTotals;
  unassigned: ClassifiedLine[];
  bank: { bucket: string; cashNGN: number }[];
  pointsLiabilityNGN: number;
  pointsOutstanding: number;
  pointsRateNGN: number;
  asOf: string;
};

function naira(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function LedgerReportClient() {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [line, setLine] = useState<"" | FinanceLine>("");
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ from, to });
    if (line) p.set("line", line);
    return p.toString();
  }, [from, to, line]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/ledger?${qs}`);
      if (res.ok) setData((await res.json()) as Report);
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-choc">Accounts</h1>
        <p className="mt-1 font-sans text-sm text-[#6B6B68]">
          Every confirmed ledger row.{" "}
          <Link href="/admin/reports" className="text-choc underline">
            How we are doing
          </Link>{" "}
          is the short view.
        </p>
      </div>
      <FinanceAa0Note />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label className="font-sans text-xs text-[#6B6B68]">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block min-h-[44px] border border-sand px-2"
          />
        </label>
        <label className="font-sans text-xs text-[#6B6B68]">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block min-h-[44px] border border-sand px-2"
          />
        </label>
        <label className="font-sans text-xs text-[#6B6B68]">
          Line
          <select
            value={line}
            onChange={(e) => setLine(e.target.value as "" | FinanceLine)}
            className="mt-1 block min-h-[44px] border border-sand px-2"
          >
            <option value="">Both</option>
            <option value="RTW">Ready-to-wear</option>
            <option value="ATELIER">Atelier</option>
          </select>
        </label>
        <a href={`/api/admin/reports/ledger/export?${qs}&format=csv`} className="min-h-[44px] border border-sand px-4 py-2 font-sans text-xs uppercase tracking-wider">
          CSV
        </a>
        <a href={`/api/admin/reports/ledger/export?${qs}&format=xlsx`} className="min-h-[44px] bg-nut px-4 py-2 font-sans text-xs uppercase tracking-wider text-cream">
          Excel
        </a>
      </form>
      {loading ? (
        <p className="font-sans text-sm text-[#6B6B68]">Loading…</p>
      ) : !data ? (
        <p className="font-sans text-sm text-[#6B6B68]">Could not load this range.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border border-sand p-4">
              <p className="font-sans text-[10px] uppercase tracking-wider text-[#6B6B68]">Ready-to-wear cash</p>
              <p className="mt-1 font-display text-xl">{naira(data.rtw.cashNGN)}</p>
            </div>
            <div className="border border-sand p-4">
              <p className="font-sans text-[10px] uppercase tracking-wider text-[#6B6B68]">Atelier cash</p>
              <p className="mt-1 font-display text-xl">{naira(data.atelier.cashNGN)}</p>
            </div>
            <div className="border border-sand p-4">
              <p className="font-sans text-[10px] uppercase tracking-wider text-[#6B6B68]">Together</p>
              <p className="mt-1 font-display text-xl">{naira(data.combined.cashNGN)}</p>
            </div>
          </div>
          <p className="font-sans text-xs text-[#6B6B68]">
            Sales {naira(data.combined.salesNGN)} · Points {naira(data.combined.pointsNGN)} · Shipping collected{" "}
            {naira(data.combined.shippingCollectedNGN)} · Shipping paid not on the ledger yet · VAT {naira(data.combined.vatNGN)} ·
            Paid-and-cancelled still owing {naira(data.combined.liabilityNGN)} · Points outstanding {naira(data.pointsLiabilityNGN)} as of{" "}
            {new Date(data.asOf).toLocaleString("en-GB")}.
          </p>
          {data.unassigned.length > 0 ? (
            <p className="border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-800">
              {data.unassigned.length} row{data.unassigned.length === 1 ? "" : "s"} resolve to neither line or to both. They are listed
              and kept out of Ready-to-wear + Atelier.
            </p>
          ) : null}
          <div className="overflow-x-auto border border-sand">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-ivory font-sans text-[10px] uppercase tracking-wider text-[#6B6B68]">
                <tr>
                  {["Date", "NGN", "Original", "VAT", "Sales", "Cash", "Points", "Ship", "Owed back", "Method", "Purpose", "Line", "Document", "Customer", "Confirmed by"].map(
                    (h) => (
                      <th key={h} className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.lines.map((row) => (
                  <tr key={row.id} className="border-t border-sand/70">
                    <td className="whitespace-nowrap px-3 py-2">{new Date(row.at).toLocaleString("en-GB")}</td>
                    <td className="px-3 py-2 tabular-nums">{naira(row.amountNGN)}</td>
                    <td className="px-3 py-2">
                      {row.originalAmount != null
                        ? `${row.currency} ${row.originalAmount.toLocaleString()} @ ${row.fxRateLocked ?? "—"}`
                        : row.currency}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.vatNGN ? naira(row.vatNGN) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{naira(row.salesNGN)}</td>
                    <td className="px-3 py-2 tabular-nums">{naira(row.cashNGN)}</td>
                    <td className="px-3 py-2 tabular-nums">{naira(row.pointsNGN)}</td>
                    <td className="px-3 py-2 tabular-nums">{naira(row.shippingCollectedNGN)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.liabilityNGN ? naira(row.liabilityNGN) : "—"}</td>
                    <td className="px-3 py-2">{row.method}</td>
                    <td className="px-3 py-2">{row.purposeLabel}</td>
                    <td className="px-3 py-2">
                      {row.businessLine}
                      {row.resolution === "both" || row.resolution === "neither" ? ` (${row.resolution})` : ""}
                    </td>
                    <td className="px-3 py-2">{row.documentRef}</td>
                    <td className="px-3 py-2">{row.customer}</td>
                    <td className="px-3 py-2">{row.confirmedBy ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.lines.length === 0 ? (
              <p className="px-3 py-6 font-sans text-sm text-[#6B6B68]">No ledger rows in this range.</p>
            ) : null}
          </div>
          <div className="border border-sand p-4">
            <h2 className="font-display text-lg text-choc">Against the statement</h2>
            <p className="mt-1 font-sans text-xs text-[#6B6B68]">What the ledger says arrived, grouped the way the house banks it.</p>
            <ul className="mt-3 space-y-1 font-sans text-sm">
              {data.bank.length === 0 ? <li>No cash in this range.</li> : null}
              {data.bank.map((b) => (
                <li key={b.bucket} className="flex justify-between">
                  <span>{b.bucket}</span>
                  <span className="tabular-nums">{naira(b.cashNGN)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
