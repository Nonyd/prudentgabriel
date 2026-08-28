"use client";

import { useState } from "react";
import type { ProductAdminInput } from "@/validations/product";
import { buildDefaultProductSku } from "@/lib/product-sku";

type VariantRow = ProductAdminInput["variants"][number];

type VariantManagerProps = {
  slug: string;
  variants: VariantRow[];
  onChange: (next: VariantRow[]) => void;
  basePriceNGN: number;
};

export const STANDARD_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

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

  const [sizePick, setSizePick] = useState<Set<string>>(() => new Set(STANDARD_SIZES));

  const generateSizes = () => {
    const have = new Set(variants.map((v) => v.size.trim().toUpperCase()).filter(Boolean));
    const extra: VariantRow[] = [];
    let order = variants.length;
    for (const size of STANDARD_SIZES) {
      if (!sizePick.has(size)) continue;
      if (have.has(size)) continue;
      extra.push({
        size,
        sku: slug ? buildDefaultProductSku(slug, size) : `PA-ITEM-${size}`,
        priceNGN: basePriceNGN || 0,
        stock: 0,
        lowStockAt: 3,
        sortOrder: order,
      });
      order += 1;
    }
    if (extra.length === 0) return;
    const first = variants[0];
    const dropPlaceholder = variants.length === 1 && first && first.size.trim() === "";
    onChange([...(dropPlaceholder ? [] : variants), ...extra]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={applyBaseToAll}
          className="rounded-sm border border-sand px-3 py-1.5 text-xs text-gold hover:bg-gold/10"
        >
          Copy ₦{Math.round(basePriceNGN).toLocaleString()} onto every size
        </button>
        <p className="w-full text-[11px] text-[#A8A8A4]">
          This replaces per-size ₦ prices. Use it to start from one figure, then change individual sizes.
        </p>
        <button
          type="button"
          onClick={addRow}
          className="rounded-sm bg-wine px-3 py-1.5 text-xs text-gold hover:bg-wine-hover"
        >
          + Add size
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {STANDARD_SIZES.map((sz) => (
          <label key={sz} className="flex items-center gap-1 text-xs text-charcoal">
            <input
              type="checkbox"
              checked={sizePick.has(sz)}
              onChange={() => {
                setSizePick((prev) => {
                  const next = new Set(prev);
                  if (next.has(sz)) next.delete(sz);
                  else next.add(sz);
                  return next;
                });
              }}
            />
            {sz}
          </label>
        ))}
        <button
          type="button"
          onClick={generateSizes}
          className="rounded-sm border border-sand px-3 py-1.5 text-xs text-gold hover:bg-gold/10"
        >
          Generate size rows
        </button>
      </div>

      <div className="overflow-x-auto rounded-sm border border-sand">
        <table className="w-full min-w-[980px] text-left text-xs text-charcoal">
          <thead className="border-b border-sand bg-[#FAFAFA] font-label uppercase tracking-wide text-[#A8A8A4]">
            <tr>
              <th className="p-2">Size</th>
              <th className="p-2">SKU</th>
              <th className="p-2">₦ Price</th>
              <th className="p-2">$</th>
              <th className="p-2">£</th>
              <th className="p-2">Sale ₦</th>
              <th className="p-2">Stock</th>
              <th className="p-2">Low at</th>
              <th className="p-2">kg</th>
              <th className="p-2">L</th>
              <th className="p-2">W</th>
              <th className="p-2">H</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => (
              <tr key={i} className="border-b border-[#F5F5F3]">
                <td className="p-1">
                  <input
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal"
                    value={v.size}
                    onChange={(e) => update(i, { size: e.target.value })}
                  />
                </td>
                <td className="p-1">
                  <input
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 font-mono text-[11px] text-charcoal"
                    value={v.sku}
                    onChange={(e) => update(i, { sku: e.target.value })}
                    placeholder={slug ? buildDefaultProductSku(slug, v.size || "SIZE") : ""}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal"
                    value={v.priceNGN}
                    onChange={(e) => update(i, { priceNGN: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal"
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
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal"
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
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal"
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
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal"
                    value={v.stock}
                    onChange={(e) => update(i, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal"
                    value={v.lowStockAt}
                    onChange={(e) => update(i, { lowStockAt: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal"
                    value={v.weightKg ?? ""}
                    onChange={(e) =>
                      update(i, { weightKg: e.target.value === "" ? undefined : Number(e.target.value) })
                    }
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    step="0.1"
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal"
                    value={v.lengthCm ?? ""}
                    onChange={(e) =>
                      update(i, { lengthCm: e.target.value === "" ? undefined : Number(e.target.value) })
                    }
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    step="0.1"
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal"
                    value={v.widthCm ?? ""}
                    onChange={(e) =>
                      update(i, { widthCm: e.target.value === "" ? undefined : Number(e.target.value) })
                    }
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    step="0.1"
                    className="w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal"
                    value={v.heightCm ?? ""}
                    onChange={(e) =>
                      update(i, { heightCm: e.target.value === "" ? undefined : Number(e.target.value) })
                    }
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
