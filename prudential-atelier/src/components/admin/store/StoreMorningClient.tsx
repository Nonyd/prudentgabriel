"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatQty } from "@/lib/store/qty";
import { StoreSubnav } from "@/components/admin/store/StoreSubnav";

type Need = { kind: "short" | "overissued" | "unlisted" | "bom_short"; label: string; detail: string; itemId?: string };
type ItemRow = {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  storeLine: string;
  unitCost: number | null;
};
type Category = { id: string; name: string; items: ItemRow[] };
type Yesterday = {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
  itemName: string;
  unit: string;
  actorName: string;
  takenByName: string | null;
  approvedByName: string | null;
  receivedByName: string | null;
  client: string | null;
  orderRef: string | null;
  ref: string | null;
  note: string | null;
};

type View = {
  book: { dayOne: string | null; lockedAt: string | null };
  categories: Category[];
  yesterday: Yesterday[];
  needs: Need[];
  needsSource?: string;
};

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function StoreMorningClient() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/store/morning")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Could not open the book");
        setView((await res.json()) as View);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not open the book"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-text-light">Store</p>
        <h1 className="font-display text-2xl text-ink">This morning</h1>
        <p className="mt-1 max-w-2xl font-sans text-sm text-text-mid">
          What is on the shelf, what moved yesterday, and which orders need materials the store does not have.
          Low-stock alerts are the wrong signal here — the house buys just in time.
        </p>
      </div>
      <StoreSubnav />

      {error ? <p className="font-sans text-sm text-danger">{error}</p> : null}
      {!view && !error ? <p className="font-sans text-sm text-text-mid">Opening the book…</p> : null}

      {view ? (
        <>
          <p className="font-sans text-xs text-text-light">
            {view.book.dayOne
              ? `Day one ${new Date(view.book.dayOne).toLocaleDateString("en-GB", { dateStyle: "medium" })}`
              : "Day one is not locked — run the opening count before treating this as the live book."}
          </p>

          <section className="border border-sand bg-bg-card p-6">
            <h2 className="font-display text-lg text-ink">On hand</h2>
            {view.categories.every((c) => c.items.length === 0) ? (
              <p className="mt-3 font-sans text-sm text-text-mid">
                Nothing on the catalogue yet.{" "}
                <Link href="/admin/store/items" className="text-choc underline">
                  Add items
                </Link>{" "}
                then{" "}
                <Link href="/admin/store/opening" className="text-choc underline">
                  count from scratch
                </Link>
                .
              </p>
            ) : (
              <div className="mt-4 space-y-6">
                {view.categories.map((cat) => (
                  <div key={cat.id}>
                    <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-text-light">
                      {cat.name}
                    </h3>
                    {cat.items.length === 0 ? (
                      <p className="mt-1 font-sans text-sm text-text-mid">No items.</p>
                    ) : (
                      <table className="mt-2 w-full border-collapse font-sans text-sm">
                        <thead>
                          <tr className="border-b border-sand text-left text-[10px] uppercase tracking-wide text-text-light">
                            <th className="py-2 pr-3">Item</th>
                            <th className="py-2 pr-3 text-right">On hand</th>
                            <th className="py-2 text-right">Unit cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.items.map((item) => (
                            <tr key={item.id} className="border-b border-sand last:border-0">
                              <td className="py-2 pr-3">
                                {item.name}
                                <span className="ml-2 text-[10px] uppercase tracking-wide text-text-light">
                                  {item.storeLine === "SHARED" ? "" : item.storeLine}
                                </span>
                              </td>
                              <td
                                className={`py-2 pr-3 text-right tabular-nums ${item.onHand < 0 ? "text-[#C45E0A]" : ""}`}
                              >
                                {formatQty(item.onHand, item.unit)}
                              </td>
                              <td className="py-2 text-right tabular-nums text-text-mid">
                                {item.unitCost == null ? "—" : item.unitCost.toLocaleString("en-NG")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border border-sand bg-bg-card p-6">
            <h2 className="font-display text-lg text-ink">Yesterday</h2>
            {view.yesterday.length === 0 ? (
              <p className="mt-3 font-sans text-sm text-text-mid">Nothing moved yesterday.</p>
            ) : (
              <ul className="mt-3 divide-y divide-sand font-sans text-sm">
                {view.yesterday.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium uppercase tracking-wide text-text-light">{m.reason}</span>{" "}
                      {formatQty(m.delta, m.unit)} {m.itemName}
                      {m.client ? ` · ${m.client}` : ""}
                      {m.ref ? (
                        <>
                          {" "}
                          ·{" "}
                          <Link href={`/admin/store/issues/${encodeURIComponent(m.ref)}/print`} className="text-choc underline">
                            {m.ref}
                          </Link>
                        </>
                      ) : null}
                    </span>
                    <span className="text-xs text-text-light">{fmtWhen(m.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-sand bg-bg-card p-6">
            <h2 className="font-display text-lg text-ink">Needed and not in the store</h2>
            <p className="mt-1 font-sans text-sm text-text-mid">
              {view.needsSource ??
                "This is the useful signal — an order that needs materials we do not have — not a reorder level."}
            </p>
            {view.needs.length === 0 ? (
              <p className="mt-3 font-sans text-sm text-text-mid">
                Nothing outstanding against the lists we can see. An empty panel is not a full shelf — pieces without
                a material list never appear here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 font-sans text-sm">
                {view.needs.map((n, i) => (
                  <li key={`${n.kind}-${n.label}-${i}`} className="border-b border-sand py-2 last:border-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-text-light">{n.kind}</span>
                    <p className="font-medium text-ink">{n.label}</p>
                    <p className="text-text-mid">{n.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
