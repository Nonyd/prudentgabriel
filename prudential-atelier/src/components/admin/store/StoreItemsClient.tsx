"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { STORE_FIELD, StoreSubnav } from "@/components/admin/store/StoreSubnav";
import { SUGGESTED_UNITS, formatQty } from "@/lib/store/qty";

type Category = { id: string; name: string; sortOrder: number };
type Item = {
  id: string;
  name: string;
  unit: string;
  spec: string | null;
  supplier: string | null;
  unitCost: number | null;
  storeLine: string;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  onHand: number;
};

const LINES = ["SHARED", "ATELIER", "RTW"] as const;

export function StoreItemsClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [catName, setCatName] = useState("");
  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    unit: "yard",
    spec: "",
    supplier: "",
    unitCost: "",
    storeLine: "SHARED",
  });

  const load = useCallback(async () => {
    const [cRes, iRes] = await Promise.all([
      fetch("/api/admin/store/categories"),
      fetch("/api/admin/store/items?inactive=1"),
    ]);
    if (cRes.ok) {
      const data = (await cRes.json()) as { items: Category[] };
      setCategories(data.items);
      setForm((f) => (f.categoryId ? f : { ...f, categoryId: data.items[0]?.id ?? "" }));
    }
    if (iRes.ok) {
      const data = (await iRes.json()) as { items: Item[] };
      setItems(data.items);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addCategory = async () => {
    if (!catName.trim()) return;
    const res = await fetch("/api/admin/store/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: catName.trim(), sortOrder: (categories.at(-1)?.sortOrder ?? 0) + 10 }),
    });
    if (!res.ok) {
      toast.error((await res.json()).error ?? "Could not add category");
      return;
    }
    setCatName("");
    toast.success("Category added");
    await load();
  };

  const addItem = async () => {
    if (!form.name.trim() || !form.categoryId || !form.unit.trim()) return;
    const res = await fetch("/api/admin/store/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        categoryId: form.categoryId,
        unit: form.unit.trim(),
        spec: form.spec.trim() || null,
        supplier: form.supplier.trim() || null,
        unitCost: form.unitCost ? Number(form.unitCost) : null,
        storeLine: form.storeLine,
      }),
    });
    if (!res.ok) {
      toast.error((await res.json()).error ?? "Could not add item");
      return;
    }
    setForm((f) => ({ ...f, name: "", spec: "", supplier: "", unitCost: "" }));
    toast.success("Item added");
    await load();
  };

  const toggleActive = async (item: Item) => {
    const res = await fetch(`/api/admin/store/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    if (!res.ok) {
      toast.error("Could not update item");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-text-light">Store</p>
        <h1 className="font-display text-2xl text-ink">Catalogue</h1>
        <p className="mt-1 max-w-2xl font-sans text-sm text-text-mid">
          Categories are rows, not a deploy. Unit is free text per item — yard first. Stock line is Shared until
          atelier and ready-to-wear split.
        </p>
      </div>
      <StoreSubnav />

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-lg text-ink">Add a category</h2>
        <div className="mt-3 flex max-w-md gap-2">
          <input
            className={STORE_FIELD}
            placeholder="Hangers"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
          />
          <Button size="sm" onClick={() => void addCategory()}>
            Add
          </Button>
        </div>
        <p className="mt-2 font-sans text-xs text-text-light">
          {categories.map((c) => c.name).join(" · ") || "None yet"}
        </p>
      </section>

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-lg text-ink">Add an item</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            className={STORE_FIELD}
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <select
            className={STORE_FIELD}
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div>
            <input
              className={STORE_FIELD}
              list="store-units"
              placeholder="Unit"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
            <datalist id="store-units">
              {SUGGESTED_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <input
            className={STORE_FIELD}
            placeholder="Spec (colour, width…)"
            value={form.spec}
            onChange={(e) => setForm((f) => ({ ...f, spec: e.target.value }))}
          />
          <input
            className={STORE_FIELD}
            placeholder="Supplier (optional note)"
            value={form.supplier}
            onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
          />
          <input
            className={STORE_FIELD}
            placeholder="Unit cost"
            type="number"
            value={form.unitCost}
            onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
          />
          <select
            className={STORE_FIELD}
            value={form.storeLine}
            onChange={(e) => setForm((f) => ({ ...f, storeLine: e.target.value }))}
          >
            {LINES.map((l) => (
              <option key={l} value={l}>
                {l === "SHARED" ? "Shared (today)" : l}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <Button size="sm" onClick={() => void addItem()}>
            Add item
          </Button>
        </div>
      </section>

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-lg text-ink">Items</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse font-sans text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-[10px] uppercase tracking-wide text-text-light">
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3 text-right">On hand</th>
                <th className="py-2 pr-3">Line</th>
                <th className="py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-sand last:border-0">
                  <td className="py-2 pr-3">
                    {item.name}
                    <span className="ml-2 text-xs text-text-light">{item.unit}</span>
                    {!item.isActive ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-text-light">Inactive</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-text-mid">{item.categoryName}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatQty(item.onHand, item.unit)}</td>
                  <td className="py-2 pr-3 text-xs uppercase tracking-wide text-text-light">{item.storeLine}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="font-sans text-xs text-choc underline"
                      onClick={() => void toggleActive(item)}
                    >
                      {item.isActive ? "Retire" : "Restore"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
