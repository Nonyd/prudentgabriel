"use client";

import { Fragment, useState } from "react";
import type { ProductAdminInput } from "@/validations/product";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { buildDefaultProductSku, variantTableColumns } from "@/lib/product-sku";
import { compareSizeLabels, sortBySize } from "@/lib/sizing";

type VariantRow = ProductAdminInput["variants"][number];

type VariantManagerProps = {
  productName: string;
  variants: VariantRow[];
  onChange: (next: VariantRow[]) => void;
  basePriceNGN: number;
  isOnSale: boolean;
  onRegenerate?: () => void;
};

/** UK numeric sizes this house actually stocks. */
export const STANDARD_SIZES = ["6", "8", "10", "12", "14", "16", "18", "20", "22"] as const;

function emptyRow(productName: string, size: string, priceNGN: number, sortOrder: number): VariantRow {
  return {
    size,
    sku: productName ? buildDefaultProductSku(productName, size || "SIZE") : "",
    skuManual: false,
    priceNGN,
    stock: 0,
    lowStockAt: 3,
    sortOrder,
  };
}

export function VariantManager({
  productName,
  variants,
  onChange,
  basePriceNGN,
  isOnSale,
  onRegenerate,
}: VariantManagerProps) {
  const [advanced, setAdvanced] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const cols = variantTableColumns({ onSale: isOnSale, advanced });

  const update = (index: number, patch: Partial<VariantRow>) => {
    const next = variants.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onChange(next);
  };

  const addRow = () => {
    onChange([...variants, emptyRow(productName, "", basePriceNGN || 0, variants.length)]);
  };

  const removeRow = (index: number) => {
    if (variants.length === 0) return;
    onChange(variants.filter((_, i) => i !== index));
  };

  const applyBaseToAll = () => {
    onChange(variants.map((v) => ({ ...v, priceNGN: basePriceNGN })));
    setCopyOpen(false);
  };

  const [sizePick, setSizePick] = useState<Set<string>>(() => new Set(STANDARD_SIZES));

  const generateSizes = () => {
    const have = new Set(variants.map((v) => v.size.trim()).filter(Boolean));
    const extra: VariantRow[] = [];
    let order = variants.length;
    for (const size of STANDARD_SIZES) {
      if (!sizePick.has(size)) continue;
      if (have.has(size)) continue;
      extra.push(emptyRow(productName, size, basePriceNGN || 0, order));
      order += 1;
    }
    if (extra.length === 0) return;
    const first = variants[0];
    const dropPlaceholder = variants.length === 1 && first && first.size.trim() === "";
    const merged = [...(dropPlaceholder ? [] : variants), ...extra];
    onChange(sortBySize(merged, (row) => row.size).map((row, order) => ({ ...row, sortOrder: order })));
  };

  const cell = "w-full rounded-sm border border-sand bg-canvas px-2 py-1 text-charcoal";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded-sm bg-wine px-3 py-1.5 text-xs text-gold hover:bg-wine-hover"
        >
          + Add size
        </button>
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="rounded-sm border border-sand px-3 py-1.5 text-xs text-gold hover:bg-gold/10"
        >
          {advanced ? "Hide advanced" : "Advanced"}
        </button>
        {onRegenerate ? (
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-sm border border-sand px-3 py-1.5 text-xs text-gold hover:bg-gold/10"
          >
            Regenerate stock codes
          </button>
        ) : null}
      </div>

      <div className="rounded-sm border border-sand bg-[#FAFAFA] p-3">
        <p className="text-xs uppercase tracking-wide text-[#A8A8A4]">Copy this price onto every size</p>
        <p className="mt-1 text-[11px] text-[#6B6B68]">Replaces each size’s naira price. There is no undo.</p>
        <button
          type="button"
          onClick={() => setCopyOpen(true)}
          className="mt-2 rounded-sm border border-sand bg-canvas px-3 py-1.5 text-xs text-gold hover:bg-gold/10"
        >
          Copy ₦{Number.isFinite(basePriceNGN) ? Math.round(basePriceNGN).toLocaleString() : "0"} onto every size
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
          Add these sizes
        </button>
      </div>

      <div className="rounded-sm border border-sand">
        <table className="w-full text-left text-xs text-charcoal">
          <thead className="border-b border-sand bg-[#FAFAFA] font-label uppercase tracking-wide text-[#A8A8A4]">
            <tr>
              <th className="p-2">Size</th>
              <th className="p-2">Price in naira</th>
              {cols.sale ? <th className="p-2">Sale price</th> : null}
              <th className="p-2">Stock</th>
              <th className="w-8 p-2" />
            </tr>
          </thead>
          <tbody>
            {variants.length === 0 ? (
              <tr>
                <td colSpan={cols.sale ? 5 : 4} className="p-3 text-[#A8A8A4]">
                  Add at least one size. Tick 6–22 and click “Add these sizes”.
                </td>
              </tr>
            ) : (
              variants
                .map((v, i) => ({ v, i }))
                .sort((a, b) => compareSizeLabels(a.v.size, b.v.size))
                .map(({ v, i }) => (
                <Fragment key={v.id ?? `new-${i}`}>
                  <tr className="border-b border-[#F5F5F3]">
                    <td className="p-1">
                      <input
                        className={cell}
                        value={v.size}
                        onChange={(e) => {
                          const size = e.target.value;
                          const patch: Partial<VariantRow> = { size };
                          if (!v.skuManual) patch.sku = buildDefaultProductSku(productName, size || "SIZE");
                          update(i, patch);
                        }}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        className={cell}
                        value={v.priceNGN || ""}
                        onChange={(e) => update(i, { priceNGN: Number(e.target.value) || 0 })}
                      />
                    </td>
                    {cols.sale ? (
                      <td className="p-1">
                        <input
                          type="number"
                          className={cell}
                          value={v.salePriceNGN ?? ""}
                          onChange={(e) =>
                            update(i, {
                              salePriceNGN: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                    ) : null}
                    <td className="p-1">
                      <input
                        type="number"
                        className={cell}
                        value={v.stock}
                        onChange={(e) =>
                          update(i, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                        }
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        disabled={variants.length <= 1}
                        onClick={() => removeRow(i)}
                        className="text-red-400 disabled:opacity-30"
                        aria-label="Remove size"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                  {advanced ? (
                    <tr className="border-b border-[#F5F5F3] bg-[#FAFAFA]">
                      <td colSpan={cols.sale ? 5 : 4} className="p-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="text-[11px] uppercase text-[#A8A8A4]">
                            Stock code
                            <input
                              className={`${cell} mt-0.5 font-mono text-[11px]`}
                              value={v.sku}
                              onChange={(e) => update(i, { sku: e.target.value, skuManual: true })}
                              placeholder={
                                productName ? buildDefaultProductSku(productName, v.size || "SIZE") : ""
                              }
                            />
                          </label>
                          <label className="text-[11px] uppercase text-[#A8A8A4]">
                            Price in dollars
                            <input
                              type="number"
                              className={`${cell} mt-0.5`}
                              value={v.priceUSD ?? ""}
                              onChange={(e) =>
                                update(i, {
                                  priceUSD: e.target.value === "" ? undefined : Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="text-[11px] uppercase text-[#A8A8A4]">
                            Price in pounds
                            <input
                              type="number"
                              className={`${cell} mt-0.5`}
                              value={v.priceGBP ?? ""}
                              onChange={(e) =>
                                update(i, {
                                  priceGBP: e.target.value === "" ? undefined : Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="text-[11px] uppercase text-[#A8A8A4]">
                            Low stock at
                            <input
                              type="number"
                              className={`${cell} mt-0.5`}
                              value={v.lowStockAt}
                              onChange={(e) =>
                                update(i, { lowStockAt: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                              }
                            />
                          </label>
                          <label className="text-[11px] uppercase text-[#A8A8A4]">
                            Packed weight kg
                            <input
                              type="number"
                              step="0.01"
                              className={`${cell} mt-0.5`}
                              value={v.weightKg ?? ""}
                              onChange={(e) =>
                                update(i, { weightKg: e.target.value === "" ? undefined : Number(e.target.value) })
                              }
                            />
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            <label className="text-[11px] uppercase text-[#A8A8A4]">
                              Box L
                              <input
                                type="number"
                                step="0.1"
                                className={`${cell} mt-0.5`}
                                value={v.lengthCm ?? ""}
                                onChange={(e) =>
                                  update(i, {
                                    lengthCm: e.target.value === "" ? undefined : Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label className="text-[11px] uppercase text-[#A8A8A4]">
                              Box W
                              <input
                                type="number"
                                step="0.1"
                                className={`${cell} mt-0.5`}
                                value={v.widthCm ?? ""}
                                onChange={(e) =>
                                  update(i, {
                                    widthCm: e.target.value === "" ? undefined : Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label className="text-[11px] uppercase text-[#A8A8A4]">
                              Box H
                              <input
                                type="number"
                                step="0.1"
                                className={`${cell} mt-0.5`}
                                value={v.heightCm ?? ""}
                                onChange={(e) =>
                                  update(i, {
                                    heightCm: e.target.value === "" ? undefined : Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        variant="warning"
        title="Replace every size’s price?"
        description={`This sets every size to ₦${Number.isFinite(basePriceNGN) ? Math.round(basePriceNGN).toLocaleString() : "0"}. Per-size prices you already typed will be lost.`}
        confirmLabel="Copy onto every size"
        onConfirm={applyBaseToAll}
      />
    </div>
  );
}
