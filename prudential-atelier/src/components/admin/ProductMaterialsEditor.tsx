"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

type StoreItem = { id: string; name: string; unit: string };
type Option = { id: string; label: string };
type MatLine = {
  itemId: string;
  productOptionId: string;
  quantityPerUnit: string;
  unit: string;
  isOptional: boolean;
};

/**
 * AQ10 — optional material list on a product (or a Slice AU option).
 * A piece with no list still sells; it simply does not forecast.
 */
export function ProductMaterialsEditor({
  productId,
  options = [],
}: {
  productId: string;
  options?: Option[];
}) {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [lines, setLines] = useState<MatLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [matRes, itemRes] = await Promise.all([
      fetch(`/api/admin/products/${productId}/materials`),
      fetch("/api/admin/store/items"),
    ]);
    if (matRes.ok) {
      const data = (await matRes.json()) as {
        items: {
          itemId: string;
          productOptionId: string | null;
          quantityPerUnit: number;
          unit: string;
          isOptional: boolean;
        }[];
      };
      setLines(
        data.items.map((m) => ({
          itemId: m.itemId,
          productOptionId: m.productOptionId ?? "",
          quantityPerUnit: String(m.quantityPerUnit),
          unit: m.unit,
          isOptional: m.isOptional,
        })),
      );
    }
    if (itemRes.ok) {
      setItems(((await itemRes.json()) as { items: StoreItem[] }).items);
    }
    setLoaded(true);
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const res = await fetch(`/api/admin/products/${productId}/materials`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: lines
          .filter((l) => l.itemId && l.quantityPerUnit)
          .map((l) => ({
            itemId: l.itemId,
            productOptionId: l.productOptionId || null,
            quantityPerUnit: l.quantityPerUnit,
            unit: l.unit || "yard",
            isOptional: l.isOptional,
          })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not save materials");
      return;
    }
    toast.success(lines.length === 0 ? "No material list — piece still sells" : "Material list saved");
  };

  if (!loaded) return <p className="mt-4 text-xs text-[#A8A8A4]">Loading materials…</p>;

  return (
    <div className="mt-8 border-t border-[#E8E4DC] pt-6">
      <h3 className="font-display text-xl text-choc">Material list</h3>
      <p className="mt-1 text-xs text-[#A8A8A4]">
        Optional. Four metres of a fabric, one zip — so forty-eight orders become a yardage figure. A piece with no
        list still sells; it simply does not forecast.
      </p>
      <div className="mt-4 space-y-3">
        {lines.map((line, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-5">
            <select
              className="rounded-[3px] border border-[#E8E4DC] bg-white px-2 py-2 text-sm"
              value={line.itemId}
              onChange={(e) => {
                const next = [...lines];
                const it = items.find((x) => x.id === e.target.value);
                next[i] = { ...line, itemId: e.target.value, unit: it?.unit || line.unit };
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
            <select
              className="rounded-[3px] border border-[#E8E4DC] bg-white px-2 py-2 text-sm"
              value={line.productOptionId}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...line, productOptionId: e.target.value };
                setLines(next);
              }}
            >
              <option value="">All options</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              className="rounded-[3px] border border-[#E8E4DC] bg-white px-2 py-2 text-sm"
              placeholder="Qty / unit"
              value={line.quantityPerUnit}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...line, quantityPerUnit: e.target.value };
                setLines(next);
              }}
            />
            <input
              className="rounded-[3px] border border-[#E8E4DC] bg-white px-2 py-2 text-sm"
              placeholder="Unit"
              value={line.unit}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...line, unit: e.target.value };
                setLines(next);
              }}
            />
            <label className="flex items-center gap-2 text-xs text-charcoal">
              <input
                type="checkbox"
                checked={line.isOptional}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...line, isOptional: e.target.checked };
                  setLines(next);
                }}
              />
              Optional
            </label>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className="text-xs text-choc underline"
          onClick={() =>
            setLines([
              ...lines,
              { itemId: "", productOptionId: "", quantityPerUnit: "", unit: "yard", isOptional: false },
            ])
          }
        >
          Add material
        </button>
        <Button type="button" onClick={() => void save()}>
          Save material list
        </Button>
      </div>
    </div>
  );
}
