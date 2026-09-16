"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { STORE_FIELD, StoreSubnav } from "@/components/admin/store/StoreSubnav";

type Person = { id: string; name: string };
type Item = { id: string; name: string; unit: string; categoryName: string; onHand: number };
type Book = { dayOne: string | null; lockedAt: string | null };

export function StoreOpeningClient() {
  const [book, setBook] = useState<Book | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [countedById, setCountedById] = useState("");
  const [dayOne, setDayOne] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [openRes, lookRes, itemRes] = await Promise.all([
      fetch("/api/admin/store/opening"),
      fetch("/api/admin/store/lookups"),
      fetch("/api/admin/store/items"),
    ]);
    if (openRes.ok) {
      const data = (await openRes.json()) as { book: Book };
      setBook(data.book);
    }
    if (lookRes.ok) {
      const data = (await lookRes.json()) as { people: Person[] };
      setPeople(data.people);
      setCountedById((id) => id || data.people[0]?.id || "");
    }
    if (itemRes.ok) {
      const data = (await itemRes.json()) as { items: Item[] };
      setItems(data.items);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const locked = Boolean(book?.dayOne);

  const commit = async () => {
    const lines = Object.entries(counts)
      .filter(([, q]) => q.trim())
      .map(([itemId, quantity]) => ({ itemId, quantity }));
    if (lines.length === 0) {
      toast.error("Count at least one item");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/store/opening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedById, dayOne, lines }),
      });
      if (!res.ok) {
        toast.error((await res.json()).error ?? "Could not lock day one");
        return;
      }
      toast.success("Opening count locked");
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-text-light">Store</p>
        <h1 className="font-display text-2xl text-ink">Opening count</h1>
        <p className="mt-1 max-w-2xl font-sans text-sm text-text-mid">
          A full count from scratch — not a spreadsheet import. Each quantity writes an OPENING movement. Locking the
          date is the store&apos;s day one. If something is found later, record an adjustment with a note, not a
          backdated opening.
        </p>
      </div>
      <StoreSubnav />

      {locked ? (
        <p className="border border-sand bg-bg-card px-4 py-3 font-sans text-sm text-text-mid">
          Day one is locked at{" "}
          {book?.dayOne
            ? new Date(book.dayOne).toLocaleDateString("en-GB", { dateStyle: "medium" })
            : "—"}
          . Later finds are adjustments.
        </p>
      ) : (
        <>
          <section className="border border-sand bg-bg-card p-6">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block font-sans text-xs text-text-mid">
                Who counted
                <select
                  className={`${STORE_FIELD} mt-1`}
                  value={countedById}
                  onChange={(e) => setCountedById(e.target.value)}
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block font-sans text-xs text-text-mid">
                Date
                <input
                  type="date"
                  className={`${STORE_FIELD} mt-1`}
                  value={dayOne}
                  onChange={(e) => setDayOne(e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="border border-sand bg-bg-card p-6">
            <h2 className="font-display text-lg text-ink">Count</h2>
            {items.length === 0 ? (
              <p className="mt-3 font-sans text-sm text-text-mid">Add items to the catalogue first.</p>
            ) : (
              <ul className="mt-3 divide-y divide-sand">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <div>
                      <p className="font-sans text-sm text-ink">{item.name}</p>
                      <p className="font-sans text-xs text-text-light">
                        {item.categoryName} · {item.unit}
                      </p>
                    </div>
                    <input
                      className={`${STORE_FIELD} w-32`}
                      placeholder={`Qty (${item.unit})`}
                      value={counts[item.id] ?? ""}
                      onChange={(e) => setCounts((m) => ({ ...m, [item.id]: e.target.value }))}
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <Button size="sm" loading={saving} onClick={() => void commit()}>
                Write openings and lock day one
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
