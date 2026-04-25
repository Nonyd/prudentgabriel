"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<string, string> = {
  newest: "Sort: Newest",
  "price-asc": "Sort: Price ↑",
  "price-desc": "Sort: Price ↓",
  featured: "Sort: Featured",
};

function useQs() {
  const sp = useSearchParams();
  const router = useRouter();
  const remove = (keys: string[]) => {
    const n = new URLSearchParams(sp.toString());
    for (const k of keys) n.delete(k);
    n.delete("page");
    router.push(`/shop?${n.toString()}`);
  };
  const setOne = (key: string, value: string | null) => {
    const n = new URLSearchParams(sp.toString());
    if (value === null || value === "") n.delete(key);
    else n.set(key, value);
    n.delete("page");
    router.push(`/shop?${n.toString()}`);
  };
  return { sp, router, remove, setOne };
}

export function ActiveFilters({ className }: { className?: string }) {
  const { sp, router, remove, setOne } = useQs();
  const category = sp.get("category");
  const type = sp.get("type");
  const tags = sp.get("tags");
  const sizes = sp.get("sizes");
  const sale = sp.get("sale") === "true";
  const minP = sp.get("minPrice");
  const maxP = sp.get("maxPrice");
  const sort = sp.get("sort") ?? "newest";
  const inStock = sp.get("inStock");

  const pills: { label: string; onRemove: () => void }[] = [];

  if (category) pills.push({ label: `Category: ${category}`, onRemove: () => remove(["category"]) });
  if (type) pills.push({ label: `Type: ${type}`, onRemove: () => remove(["type"]) });
  if (tags)
    tags.split(",").forEach((t) => {
      const tag = t.trim();
      if (!tag) return;
      pills.push({
        label: `Tag: ${tag}`,
        onRemove: () => {
          const rest = tags
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s && s !== tag);
          setOne("tags", rest.length ? rest.join(",") : null);
        },
      });
    });
  if (sizes)
    sizes.split(",").forEach((s) => {
      const sz = s.trim();
      if (!sz) return;
      pills.push({
        label: `Size: ${sz}`,
        onRemove: () => {
          const rest = sizes
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x && x !== sz);
          setOne("sizes", rest.length ? rest.join(",") : null);
        },
      });
    });
  if (sale) pills.push({ label: "Sale only", onRemove: () => remove(["sale"]) });
  if (minP && minP !== "0") pills.push({ label: `Min ₦${minP}`, onRemove: () => remove(["minPrice"]) });
  if (maxP && maxP !== "1000000") pills.push({ label: `Max ₦${maxP}`, onRemove: () => remove(["maxPrice"]) });
  if (sort !== "newest") {
    pills.push({
      label: SORT_LABELS[sort] ?? `Sort: ${sort}`,
      onRemove: () => {
        const n = new URLSearchParams(sp.toString());
        n.delete("sort");
        n.delete("page");
        router.push(`/shop?${n.toString()}`);
      },
    });
  }
  if (inStock === "false") {
    pills.push({
      label: "Include out of stock",
      onRemove: () => remove(["inStock"]),
    });
  }

  if (pills.length === 0) return null;

  return (
    <div
      className={cn(
        "flex w-full gap-2 overflow-x-auto border-b border-mid-grey bg-canvas px-6 py-2 md:px-8",
        className,
      )}
    >
      {pills.map((p, i) => (
        <span
          key={`${p.label}-${i}`}
          className="inline-flex shrink-0 items-center gap-2 border border-olive px-3 py-1 font-body text-[11px] text-olive"
        >
          {p.label}
          <button type="button" className="p-0.5 hover:opacity-70" aria-label={`Remove ${p.label}`} onClick={p.onRemove}>
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </span>
      ))}
      {pills.length > 1 && (
        <Link
          href="/shop"
          className="shrink-0 self-center font-body text-[11px] text-dark-grey underline-offset-2 hover:text-olive hover:underline"
        >
          Clear all
        </Link>
      )}
    </div>
  );
}
