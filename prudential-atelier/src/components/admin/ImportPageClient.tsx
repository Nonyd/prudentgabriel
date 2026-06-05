"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import type { ProductCategory } from "@prisma/client";
import { cn } from "@/lib/utils";
import type { ParsedProduct } from "@/lib/woocommerce-parser";

type EnrichedProduct = ParsedProduct & { isDuplicate?: boolean };

type ParseResponse = {
  total: number;
  importable: number;
  skipped: number;
  products: EnrichedProduct[];
  error?: string;
};

type ExecuteResponse = {
  imported: number;
  failed: number;
  errors: string[];
  productIds: string[];
};

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  BRIDAL: "Bridal",
  EVENING_WEAR: "Evening",
  CASUAL: "Casual",
  FORMAL: "Formal",
  KIDDIES: "Kiddies",
  ACCESSORIES: "Accessories",
};

export function ImportPageClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [previewData, setPreviewData] = useState<ParseResponse | null>(null);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ExecuteResponse | null>(null);

  const importableProducts = useMemo(
    () => previewData?.products.filter((p) => p.isImportable && !p.isDuplicate) ?? [],
    [previewData],
  );

  const onPickFile = (file: File | null) => {
    setError("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setSelectedFile(null);
      setError("Please upload a CSV file");
      return;
    }
    setSelectedFile(file);
  };

  const parseCsv = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      const res = await fetch("/api/admin/import/parse", { method: "POST", body: formData });
      const data = (await res.json()) as ParseResponse;
      if (!res.ok) {
        setError(data.error ?? "Failed to parse CSV");
        return;
      }
      setPreviewData(data);
      setSelectedSlugs(new Set(data.products.filter((p) => p.isImportable && !p.isDuplicate).map((p) => p.slug)));
      setStep(2);
    } catch {
      setError("Failed to parse CSV");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSlug = (slug: string, enabled: boolean) => {
    if (!enabled) return;
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const selectAllImportable = () => {
    setSelectedSlugs(new Set(importableProducts.map((p) => p.slug)));
  };

  const startImport = async () => {
    if (!previewData || selectedSlugs.size === 0) return;
    setImporting(true);
    setError("");
    setStep(3);
    try {
      const products = previewData.products.filter((p) => selectedSlugs.has(p.slug));
      const res = await fetch("/api/admin/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products }),
      });
      const data = (await res.json()) as ExecuteResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        setStep(2);
        return;
      }
      setResult(data);
    } catch {
      setError("Import failed");
      setStep(2);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedFile(null);
    setPreviewData(null);
    setSelectedSlugs(new Set());
    setResult(null);
    setError("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Import Products from WooCommerce</h1>
        <p className="mt-1 font-body text-[13px] text-[#6B6B68]">Upload your WooCommerce CSV export</p>
      </div>

      {step === 1 ? (
        <section>
          <button
            type="button"
            className={cn(
              "w-full rounded-sm border-2 border-dashed border-[#EBEBEA] p-12 text-center transition-colors",
              dragging && "border-olive bg-olive/5",
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onPickFile(e.dataTransfer.files[0] ?? null);
            }}
          >
            <Upload size={32} className="mx-auto text-[#A8A8A4]" />
            <p className="mt-2 font-body text-sm text-charcoal">Drop CSV file here or click to upload</p>
            <p className="mt-1 text-[11px] text-charcoal-light">.csv files only</p>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />

          {selectedFile ? (
            <div className="mt-4 rounded-sm border border-border bg-canvas p-3 text-sm text-charcoal">
              Selected: {selectedFile.name} ({Math.ceil(selectedFile.size / 1024)} KB)
            </div>
          ) : null}

          {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

          <button
            type="button"
            onClick={() => void parseCsv()}
            disabled={!selectedFile || isLoading}
            className="mt-4 w-full rounded-sm bg-olive px-4 py-3 font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? "Parsing…" : "Parse & Preview"}
          </button>
        </section>
      ) : null}

      {step === 2 && previewData ? (
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={selectAllImportable} className="border border-border px-3 py-1.5 font-body text-xs">
              Select all importable
            </button>
            <button type="button" onClick={() => setSelectedSlugs(new Set())} className="border border-border px-3 py-1.5 font-body text-xs">
              Deselect all
            </button>
            <span className="ml-auto font-body text-sm text-charcoal">
              {previewData.importable} of {previewData.total} products ready to import
            </span>
          </div>

          <div className="overflow-x-auto border border-[#EBEBEA]">
            <table className="w-full min-w-[800px] border-collapse font-body text-xs">
              <thead>
                <tr className="bg-[#37392d] text-left text-[10px] font-medium uppercase tracking-[0.1em] text-white">
                  <th className="px-3 py-2 w-10" />
                  <th className="px-3 py-2 w-14">Image</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Sizes</th>
                  <th className="px-3 py-2">Colours</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewData.products.map((product) => {
                  const canSelect = product.isImportable && !product.isDuplicate;
                  const selected = selectedSlugs.has(product.slug);
                  return (
                    <tr key={product.slug} className="border-t border-[#EBEBEA]">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!canSelect}
                          onChange={() => toggleSlug(product.slug, canSelect)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {product.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.images[0]}
                            alt=""
                            className="h-12 w-12 object-cover"
                            width={48}
                            height={48}
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center bg-[#F2F2F0] text-[10px] text-[#A8A8A4]">
                            —
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-charcoal">{product.name}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-sm bg-[#F2F2F0] px-2 py-0.5 text-[10px] uppercase">
                          {CATEGORY_LABELS[product.category]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {product.minPrice > 0 ? `₦${product.minPrice.toLocaleString("en-NG")}` : "—"}
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-2 text-[#6B6B68]">
                        {product.sizes.join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {product.colors.slice(0, 4).map((c) => (
                            <span
                              key={c}
                              title={c}
                              className="inline-block h-3 w-3 rounded-full border border-[#EBEBEA]"
                              style={{ backgroundColor: c.toLowerCase() }}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {product.isDuplicate ? (
                          <span className="text-amber-700">⚠ Skip — Already exists</span>
                        ) : product.isImportable ? (
                          <span className="text-emerald-700">✓ Ready</span>
                        ) : (
                          <span className="text-amber-700">⚠ Skip — {product.skipReason}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep(1)} className="font-body text-xs text-charcoal-mid">
              ← Back
            </button>
            <button
              type="button"
              disabled={selectedSlugs.size === 0 || importing}
              onClick={() => void startImport()}
              className="rounded-sm bg-olive px-6 py-2.5 font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-40"
            >
              Import selected products
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          {importing ? (
            <p className="font-body text-sm text-charcoal">Importing products…</p>
          ) : null}

          {result ? (
            <div className="space-y-4 rounded-sm border border-border bg-canvas p-6">
              <p className="font-body text-sm text-emerald-700">✓ {result.imported} products imported successfully</p>
              {result.failed > 0 ? (
                <div className="text-sm text-amber-800">
                  <p>⚠ {result.failed} products failed</p>
                  <ul className="mt-2 list-disc pl-4 text-xs">
                    {result.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="font-body text-[13px] text-[#6B6B68]">
                All products are in DRAFT status. Review and publish them from the Products page.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/admin/products?published=false"
                  className="rounded-sm bg-olive px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
                >
                  View imported products →
                </Link>
                <button type="button" onClick={reset} className="rounded-sm border border-border px-4 py-2 font-body text-sm">
                  Import again
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
