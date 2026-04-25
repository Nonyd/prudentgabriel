"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type PreviewProduct = {
  rowIndex: number;
  name: string;
  slug: string;
  imageUrls: string[];
  firstImageUrl: string;
  description: string;
  shortDesc: string;
  sku: string;
  stock: number;
  isDuplicate: boolean;
};

type PreviewResponse = {
  total: number;
  warning?: string;
  products: PreviewProduct[];
};

type LogLine = {
  tone: "ok" | "error" | "progress";
  text: string;
};

export function ImportPageClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [currentName, setCurrentName] = useState("");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ ok: 0, failed: 0, imageIssues: 0 });

  const duplicatesCount = useMemo(
    () => (previewData ? previewData.products.filter((p) => p.isDuplicate).length : 0),
    [previewData],
  );

  const selectedCount = selectedRows.size;
  const progressPct = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

  const pushLog = (line: LogLine) => setLogLines((prev) => [...prev, line]);

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
    setWarning("");
    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      const res = await fetch("/api/admin/import/preview", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as PreviewResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to parse CSV");
        return;
      }
      setPreviewData(data);
      setWarning(data.warning ?? "");
      const defaultSelected = data.products.filter((p) => !p.isDuplicate).map((p) => p.rowIndex);
      setSelectedRows(new Set(defaultSelected));
      setStep(2);
    } catch {
      setError("Failed to parse CSV");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRow = (rowIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const startImport = async () => {
    if (!previewData || selectedRows.size === 0) return;
    setStep(3);
    setDone(false);
    setLogLines([]);
    setStats({ ok: 0, failed: 0, imageIssues: 0 });
    setCurrentName("");
    setProgressCurrent(0);
    setProgressTotal(selectedRows.size);

    const response = await fetch("/api/admin/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedIndices: Array.from(selectedRows),
        products: previewData.products,
      }),
    });

    if (!response.body) {
      setError("Import stream failed");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pendingText = "";

    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      pendingText += decoder.decode(value, { stream: true });
      const chunks = pendingText.split("\n\n");
      pendingText = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const line = chunk.split("\n").find((part) => part.startsWith("data: "));
        if (!line) continue;
        const raw = line.replace("data: ", "");
        const event = JSON.parse(raw) as
          | { type: "start"; total: number }
          | { type: "progress"; current: number; total: number; name: string }
          | { type: "product_done"; name: string; imageCount: number; imageIssue?: boolean }
          | { type: "product_error"; name: string; error: string }
          | { type: "complete"; imported: number };

        if (event.type === "start") {
          setProgressTotal(event.total);
        }
        if (event.type === "progress") {
          setProgressCurrent(event.current);
          setProgressTotal(event.total);
          setCurrentName(event.name);
          pushLog({ tone: "progress", text: `⟳ ${event.name} — Importing...` });
        }
        if (event.type === "product_done") {
          setStats((prev) => ({
            ok: prev.ok + 1,
            failed: prev.failed,
            imageIssues: prev.imageIssues + (event.imageIssue ? 1 : 0),
          }));
          pushLog({ tone: "ok", text: `✓ ${event.name} — ${event.imageCount} images uploaded` });
        }
        if (event.type === "product_error") {
          setStats((prev) => ({
            ok: prev.ok,
            failed: prev.failed + 1,
            imageIssues: prev.imageIssues,
          }));
          pushLog({ tone: "error", text: `✗ ${event.name} — Failed: ${event.error}` });
        }
        if (event.type === "complete") {
          setDone(true);
          setCurrentName("");
        }
      }
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedFile(null);
    setPreviewData(null);
    setSelectedRows(new Set());
    setDone(false);
    setWarning("");
    setError("");
    setLogLines([]);
    setStats({ ok: 0, failed: 0, imageIssues: 0 });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Import Products</h1>
        <p className="mt-1 font-body text-[13px] text-[#6B6B68]">Import products from a WooCommerce CSV export</p>
      </div>

      <div className="flex items-center gap-3 text-xs text-charcoal-mid">
        <span className={cn("rounded-sm border px-2 py-1", step === 1 && "border-olive text-olive")}>1 Upload CSV</span>
        <span>→</span>
        <span className={cn("rounded-sm border px-2 py-1", step === 2 && "border-olive text-olive")}>2 Preview & Select</span>
        <span>→</span>
        <span className={cn("rounded-sm border px-2 py-1", step === 3 && "border-olive text-olive")}>3 Importing</span>
      </div>

      {step === 1 ? (
        <section>
          <div className="mb-6 rounded-sm border border-[#EBEBEA] bg-[#FAFAF8] p-6">
            <h2 className="font-body text-sm font-medium text-charcoal">How to export from WooCommerce:</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-[13px] text-charcoal-mid">
              <li>Log into your WordPress admin</li>
              <li>Go to WooCommerce → Products → All Products</li>
              <li>Click Export at the top of the page</li>
              <li>Select All columns or ensure Name and Images are included</li>
              <li>Click Generate CSV and download the file</li>
              <li>Upload the downloaded CSV file below</li>
            </ol>
            <Link href="/admin/import/help" className="mt-3 inline-block text-xs text-olive hover:underline">
              Need detailed guide?
            </Link>
          </div>

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
            <p className="mt-2 font-body text-sm text-charcoal">Drop your WooCommerce CSV here</p>
            <p className="text-xs text-charcoal-mid">or click to browse</p>
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
            className="mt-4 w-full rounded-sm bg-olive px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? "Parsing..." : "PARSE CSV & PREVIEW PRODUCTS"}
          </button>
        </section>
      ) : null}

      {step === 2 && previewData ? (
        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[#EBEBEA] bg-[#FAFAF8] p-4 text-sm">
            <span>{previewData.total} products found in CSV</span>
            <span className={cn(duplicatesCount > 0 && "rounded-sm bg-amber-100 px-2 py-1 text-amber-900")}>
              {duplicatesCount} duplicates
            </span>
            <span className="text-olive">{selectedCount} selected</span>
          </div>

          {warning ? <p className="mb-3 text-sm text-amber-700">{warning}</p> : null}

          {duplicatesCount > 0 ? (
            <div className="mb-4 rounded-sm border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              {duplicatesCount} products appear to already exist. Duplicates are unchecked by default.
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedRows(new Set(previewData.products.map((p) => p.rowIndex)))}
              className="border border-border px-2 py-1 text-xs"
            >
              Select All
            </button>
            <button type="button" onClick={() => setSelectedRows(new Set())} className="border border-border px-2 py-1 text-xs">
              Deselect All
            </button>
            <button
              type="button"
              onClick={() => setSelectedRows(new Set(previewData.products.filter((p) => !p.isDuplicate).map((p) => p.rowIndex)))}
              className="border border-border px-2 py-1 text-xs"
            >
              Select Non-Duplicates
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setStep(1)} className="px-3 py-1 text-xs text-charcoal-mid">
                ← Back
              </button>
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => void startImport()}
                className="rounded-sm bg-olive px-4 py-2 text-xs text-white disabled:opacity-40"
              >
                IMPORT SELECTED →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {previewData.products.map((product) => {
              const selected = selectedRows.has(product.rowIndex);
              return (
                <article
                  key={product.rowIndex}
                  className={cn(
                    "relative rounded-sm border border-[#EBEBEA] bg-canvas",
                    product.isDuplicate && "border-amber-300",
                    selected && "ring-2 ring-olive bg-olive/5",
                    selected && product.isDuplicate && "ring-amber-400",
                  )}
                >
                  <label className="absolute left-2 top-2 z-10">
                    <input type="checkbox" checked={selected} onChange={() => toggleRow(product.rowIndex)} />
                  </label>
                  <div className="aspect-[3/4] bg-[#F2F2F0]">
                    {product.firstImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.firstImageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl text-charcoal-light">
                        {product.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-3">
                    <h3 className="line-clamp-2 text-[13px] font-medium text-charcoal">{product.name}</h3>
                    {product.description ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#6B6B68]">{product.description}</p>
                    ) : null}
                    {product.sku ? <p className="text-[10px] text-charcoal-mid">SKU: {product.sku}</p> : null}
                    <p className="text-[10px] text-charcoal-mid">{product.imageUrls.length} images</p>
                    {product.isDuplicate ? (
                      <span className="inline-block bg-[#FFF8E7] px-2 py-0.5 text-[9px] uppercase text-[#92660A]">Duplicate</span>
                    ) : null}
                    <p className="text-[10px] text-charcoal-light">Category: Unassigned</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <div>
            <div className="h-1.5 w-full bg-border">
              <div className="h-full bg-olive transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="mt-2 text-sm text-charcoal">
              {progressCurrent} of {progressTotal} products imported
            </p>
            <p className="text-xs text-charcoal-mid">{progressPct}%</p>
          </div>

          {currentName ? <p className="text-sm text-charcoal">Importing: {currentName}...</p> : null}

          <div className="max-h-64 overflow-y-auto rounded-sm border border-[#EBEBEA] bg-[#FAFAF8] p-4">
            {logLines.map((line, index) => (
              <p
                key={`${line.text}-${index}`}
                className={cn(
                  "text-xs",
                  line.tone === "ok" && "text-emerald-700",
                  line.tone === "error" && "text-red-600",
                  line.tone === "progress" && "text-charcoal-mid",
                )}
              >
                {line.text}
              </p>
            ))}
          </div>

          {done ? (
            <div className="space-y-4 rounded-sm border border-border bg-canvas p-4">
              <h2 className="font-display text-3xl text-ink">Import Complete!</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="border border-emerald-300 bg-emerald-50 p-3 text-sm">✓ {stats.ok} imported successfully</div>
                <div className="border border-amber-300 bg-amber-50 p-3 text-sm">⚠ {stats.imageIssues} had image issues</div>
                <div className="border border-red-300 bg-red-50 p-3 text-sm">✗ {stats.failed} failed</div>
              </div>
              <div className="rounded-sm border border-olive/30 bg-olive/10 p-3 text-sm text-charcoal">
                All imported products are saved as drafts. Set prices, category, sizes, then publish.
              </div>
              <div className="space-y-2">
                <Link href="/admin/products?status=draft&sort=newest" className="block rounded-sm bg-olive px-4 py-2 text-center text-sm text-white">
                  VIEW IMPORTED PRODUCTS
                </Link>
                <button type="button" onClick={reset} className="w-full rounded-sm border border-border px-4 py-2 text-sm">
                  IMPORT MORE
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
