"use client";

import type { ProductAdminInput } from "@/validations/product";
import { buildDefaultProductSku } from "@/lib/product-sku";

type VariantRow = ProductAdminInput["variants"][number];

type VariantManagerProps = {
  slug: string;
  variants: VariantRow[];
  onChange: (next: VariantRow[]) => void;
  basePriceNGN: number;
};

export function VariantManager({ slug, variants, onChange, basePriceNGN }: VariantManagerProps) {
  const update = (index: number, patch: Partial<VariantRow>) => {
    const next = variants.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...variants,
      {
        size: "",
        sku: slug ? buildDefaultProductSku(slug, "NEW") : "PA-ITEM-NEW",
        priceNGN: basePriceNGN || 0,
        stock: 0,
        lowStockAt: 3,
        sortOrder: variants.length,
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (variants.length <= 1) return;
    onChange(variants.filter((_, i) => i !== index));
  };

  const applyBaseToAll = () => {
    onChange(variants.map((v) => ({ ...v, priceNGN: basePriceNGN })));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={applyBaseToAll}
          className="rounded-sm border border-gold/30 px-3 py-1.5 text-xs text-gold hover:bg-gold/10"
        >
          Apply ₦{Math.round(basePriceNGN).toLocaleString()} to all variants
        </button>
        <button
          type="button"
          onClick={addRow}
          className="rounded-sm bg-wine px-3 py-1.5 text-xs text-gold hover:bg-wine-hover"
        >
          + Add size
        </button>
      </div>

      <div className="overflow-x-auto rounded-sm border border-gold/10">
        <table className="w-full min-w-[720px] text-left text-xs text-ivory/90">
          <thead className="border-b border-gold/10 bg-[#252525] font-label uppercase tracking-wide text-[#8A8A8A]">
            <tr>
              <th className="p-2">Size</th>
              <th className="p-2">SKU</th>
              <th className="p-2">₦ Price</th>
              <th className="p-2">$</th>
              <th className="p-2">£</th>
              <th className="p-2">Sale ₦</th>
              <th className="p-2">Stock</th>
              <th className="p-2">Low at</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => (
              <tr key={i} className="border-b border-gold/5">
                <td className="p-1">
                  <input
                    className="w-full rounded-sm border border-gold/15 bg-[#0F0F0F] px-2 py-1 text-ivory"
                    value={v.size}
                    onChange={(e) => update(i, { size: e.target.value })}
                  />
                </td>
                <td className="p-1">
                  <input
                    className="w-full rounded-sm border border-gold/15 bg-[#0F0F0F] px-2 py-1 font-mono text-[11px] text-ivory"
                    value={v.sku}
                    onChange={(e) => update(i, { sku: e.target.value })}
                    placeholder={slug ? buildDefaultProductSku(slug, v.size || "SIZE") : ""}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    className="w-full rounded-sm border border-gold/15 bg-[#0F0F0F] px-2 py-1 text-ivory"
                    value={v.priceNGN}
                    onChange={(e) => update(i, { priceNGN: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    className="w-full rounded-sm border border-gold/15 bg-[#0F0F0F] px-2 py-1 text-ivory"
                    value={v.priceUSD ?? ""}
                    onChange={(e) =>
                      update(i, {
                        priceUSD: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    className="w-full rounded-sm border border-gold/15 bg-[#0F0F0F] px-2 py-1 text-ivory"
                    value={v.priceGBP ?? ""}
                    onChange={(e) =>
                      update(i, {
                        priceGBP: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    className="w-full rounded-sm border border-gold/15 bg-[#0F0F0F] px-2 py-1 text-ivory"
                    value={v.salePriceNGN ?? ""}
                    onChange={(e) =>
                      update(i, {
                        salePriceNGN: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    className="w-full rounded-sm border border-gold/15 bg-[#0F0F0F] px-2 py-1 text-ivory"
                    value={v.stock}
                    onChange={(e) => update(i, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    className="w-full rounded-sm border border-gold/15 bg-[#0F0F0F] px-2 py-1 text-ivory"
                    value={v.lowStockAt}
                    onChange={(e) => update(i, { lowStockAt: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  />
                </td>
                <td className="p-1 text-center">
                  <button
                    type="button"
                    disabled={variants.length <= 1}
                    onClick={() => removeRow(i)}
                    className="text-red-400 disabled:opacity-30"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
