"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { optimizeImageUrl } from "@/lib/utils";
import {
  COLLECTION_DOUBLE_COUNT_COPY,
  compareSelling,
  DEMAND_COPY,
  NO_COLLECTION_ASSIGNMENTS_COPY,
  NO_ORDERS_COPY,
  NO_SALES_COPY,
  whatsSellingCsv,
  type SellingCollection,
  type SellingPiece,
  type SellingSort,
  type WhatsSellingReport,
} from "@/lib/finance/whats-selling-view";
import { HOMEPAGE_BESTSELLERS_ADMIN_NOTE } from "@/lib/homepage-bestsellers";

const SORTS: { id: SellingSort; label: string }[] = [
  { id: "units", label: "Units" },
  { id: "revenue", label: "Revenue" },
];

function naira(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function changeText(now: number, prev: number, kind: "units" | "money"): string {
  if (prev === 0 && now === 0) return "same as previous";
  if (prev === 0) return "new";
  const d = now - prev;
  if (d === 0) return "same as previous";
  if (kind === "money") return `${d > 0 ? "+" : ""}${naira(d)} vs previous`;
  return `${d > 0 ? "+" : ""}${d} vs previous`;
}

function metricKind(sort: SellingSort): "units" | "money" {
  return sort === "revenue" ? "money" : "units";
}

function metricNow(sort: SellingSort, row: { unitsSold: number; revenueNGN: number }): number {
  return sort === "revenue" ? row.revenueNGN : row.unitsSold;
}

function metricPrev(sort: SellingSort, row: { unitsPrev: number; revenuePrev: number }): number {
  return sort === "revenue" ? row.revenuePrev : row.unitsPrev;
}

function Thumb({ url }: { url: string | null; name?: string }) {
  if (!url) {
    return <span className="block h-10 w-10 shrink-0 bg-sand" aria-hidden />;
  }
  return (
    <span className="relative block h-10 w-10 shrink-0 overflow-hidden bg-sand">
      <Image src={optimizeImageUrl(url, 80)} alt="" fill className="object-cover" sizes="40px" />
    </span>
  );
}

type Ranked = {
  id: string;
  name: string;
  href: string;
  thumbnailUrl?: string | null;
  unitsSold: number;
  revenueNGN: number;
  orderedToMeasure: number;
  unitsPrev: number;
  revenuePrev: number;
};

function RankedBars({ rows, sort }: { rows: Ranked[]; sort: SellingSort }) {
  if (rows.length === 0) {
    return <p className="mt-3 font-sans text-sm text-[#6B6B68]">{NO_SALES_COPY}</p>;
  }
  const max = Math.max(...rows.map((r) => metricNow(sort, r)), 0);
  return (
    <ol className="mt-4 space-y-3">
      {rows.map((row) => {
        const value = metricNow(sort, row);
        const width = max > 0 ? Math.max(4, (value / max) * 100) : 0;
        const body: ReactNode = (
          <div className="flex items-center gap-3">
            {row.thumbnailUrl !== undefined ? <Thumb url={row.thumbnailUrl} name={row.name} /> : null}
            <div className="min-w-0 flex-1">
              <p className="truncate font-sans text-sm text-choc">{row.name}</p>
              <p className="mt-0.5 font-sans text-xs text-[#6B6B68]">
                {row.unitsSold} sold · {naira(row.revenueNGN)}
                {row.orderedToMeasure > 0 ? ` · ${row.orderedToMeasure} to measure` : ""}
                {" · "}
                {changeText(metricNow(sort, row), metricPrev(sort, row), metricKind(sort))}
              </p>
              <div className="mt-1.5 h-2 w-full bg-sand/70">
                <div className="h-2 bg-[var(--choc-deep)]" style={{ width: `${width}%` }} />
              </div>
            </div>
          </div>
        );
        return (
          <li key={row.id}>
            <Link
              href={row.href}
              className="block rounded-sm outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-choc"
            >
              {body}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function toPieceRow(p: SellingPiece): Ranked {
  return {
    id: p.productId,
    name: p.name,
    href: `/admin/products/${p.productId}/edit`,
    thumbnailUrl: p.thumbnailUrl,
    unitsSold: p.unitsSold,
    revenueNGN: p.revenueNGN,
    orderedToMeasure: p.orderedToMeasure,
    unitsPrev: p.unitsPrev,
    revenuePrev: p.revenuePrev,
  };
}

function toCollectionRow(c: SellingCollection): Ranked {
  return {
    id: c.collectionId,
    name: c.name,
    href: `/admin/collections/${c.collectionId}`,
    unitsSold: c.unitsSold,
    revenueNGN: c.revenueNGN,
    orderedToMeasure: c.orderedToMeasure,
    unitsPrev: c.unitsPrev,
    revenuePrev: c.revenuePrev,
  };
}

export function WhatsSellingPanel({ data }: { data: WhatsSellingReport }) {
  const [sort, setSort] = useState<SellingSort>("units");

  const pieces = useMemo(
    () => data.pieces.slice().sort((a, b) => compareSelling(sort, a, b)).slice(0, 10),
    [data.pieces, sort],
  );
  const collections = useMemo(
    () => data.collections.slice().sort((a, b) => compareSelling(sort, a, b)).slice(0, 10),
    [data.collections, sort],
  );
  const sizePieces = pieces.filter((p) => p.sizes.some((s) => s.sold > 0));

  function downloadCsv() {
    const csv = whatsSellingCsv(data.pieces.slice().sort((a, b) => compareSelling(sort, a, b)));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "whats-selling.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSort(s.id)}
            className={`admin-chip glass-1 glass-pill min-h-[44px] font-sans text-xs uppercase tracking-wider ${
              sort === s.id ? "border-[var(--glass-edge-bright)] text-choc" : "text-[#6B6B68]"
            }`}
          >
            {s.label}
          </button>
        ))}
        {data.pieces.length > 0 ? (
          <button type="button" onClick={downloadCsv} className="btn-ghost-light ml-auto text-[10px]">
            Export CSV
          </button>
        ) : null}
      </div>
      <p className="font-sans text-sm text-[#6B6B68]">{DEMAND_COPY}</p>
      <p className="font-sans text-sm text-[#6B6B68]">{HOMEPAGE_BESTSELLERS_ADMIN_NOTE}</p>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg text-choc">By piece</h2>
        <RankedBars rows={pieces.map(toPieceRow)} sort={sort} />
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg text-choc">By collection</h2>
        {!data.collectionsAssigned ? (
          <p className="mt-3 font-sans text-sm text-[#6B6B68]">{NO_COLLECTION_ASSIGNMENTS_COPY}</p>
        ) : (
          <>
            <p className="mt-1 font-sans text-xs text-[#6B6B68]">{COLLECTION_DOUBLE_COUNT_COPY}</p>
            <RankedBars rows={collections.map(toCollectionRow)} sort={sort} />
          </>
        )}
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg text-choc">By size</h2>
        <p className="mt-1 font-sans text-xs text-[#6B6B68]">
          Standard sizes ordered this period. Made-to-measure sits on the piece row, not here.
        </p>
        {sizePieces.length === 0 ? (
          <p className="mt-3 font-sans text-sm text-[#6B6B68]">{NO_SALES_COPY}</p>
        ) : (
          <div className="mt-4 space-y-5">
            {sizePieces.map((p) => {
              const maxSold = Math.max(...p.sizes.map((s) => s.sold), 1);
              return (
                <div key={p.productId}>
                  <p className="font-sans text-sm text-choc">{p.name}</p>
                  <ul className="mt-2 space-y-1.5">
                    {p.sizes.map((s) => (
                      <li key={s.size} className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 font-sans text-xs">
                        <span className="text-[#6B6B68]">{s.size}</span>
                        <div className="flex h-2 overflow-hidden bg-sand/70">
                          <span className="h-2 bg-[var(--choc-deep)]" style={{ width: `${(s.sold / maxSold) * 100}%` }} />
                        </div>
                        <span className="text-[#6B6B68]">{s.sold} ordered</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card-surface p-5">
        <h2 className="font-display text-lg text-choc">No orders this period</h2>
        <p className="mt-1 font-sans text-xs text-[#6B6B68]">{NO_ORDERS_COPY}</p>
        {data.notSelling.length === 0 ? (
          <p className="mt-3 font-sans text-sm text-[#6B6B68]">
            {data.pieces.length === 0 ? NO_SALES_COPY : "Every published piece had an order this period."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-sand">
            {data.notSelling.slice(0, 20).map((p) => (
              <li key={p.productId} className="flex items-center gap-3 py-2">
                <Thumb url={p.thumbnailUrl} name={p.name} />
                <Link href={`/admin/products/${p.productId}/edit`} className="min-w-0 flex-1 font-sans text-sm text-choc hover:underline">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
