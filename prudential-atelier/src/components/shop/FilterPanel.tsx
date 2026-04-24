"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Accordion from "@radix-ui/react-accordion";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "featured", label: "Featured" },
];

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Custom", "UK8", "UK10", "UK12"];
const TAGS = ["Bridal", "Evening", "Modest", "Corporate", "Kiddies", "Traditional"];

function useQs() {
  const sp = useSearchParams();
  const router = useRouter();
  const set = (updates: Record<string, string | null | undefined>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined || v === "") n.delete(k);
      else n.set(k, v);
    }
    if (!("page" in updates)) n.delete("page");
    router.push(`/shop?${n.toString()}`);
  };
  return { sp, set };
}

function toggleCsv(current: string | undefined, val: string) {
  const arr = (current ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const i = arr.indexOf(val);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(val);
  return arr.length ? arr.join(",") : "";
}

export function FilterPanel({ className }: { className?: string }) {
  const { sp, set } = useQs();
  const sort = sp.get("sort") ?? "newest";
  const type = sp.get("type") ?? "";
  const tags = sp.get("tags") ?? "";
  const sizes = sp.get("sizes") ?? "";
  const sale = sp.get("sale") === "true";
  const minP = sp.get("minPrice") ?? "0";
  const maxP = sp.get("maxPrice") ?? "1000000";
  const inStock = sp.get("inStock") !== "false";

  const active =
    Boolean(type) ||
    Boolean(tags) ||
    Boolean(sizes) ||
    sale ||
    minP !== "0" ||
    maxP !== "1000000" ||
    !inStock;

  return (
    <aside className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-charcoal">Refine</h2>
        {active && (
          <Link href="/shop" className="font-label text-[10px] uppercase tracking-wider text-wine hover:underline">
            Clear All
          </Link>
        )}
      </div>

      <Accordion.Root type="multiple" defaultValue={["sort", "type", "price", "size", "tags", "sale"]}>
        <AccItem value="sort" title="Sort">
          <div className="space-y-2">
            {SORTS.map((s) => (
              <label key={s.value} className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
                <input
                  type="radio"
                  name="sort"
                  checked={sort === s.value}
                  onChange={() => set({ sort: s.value })}
                  className="accent-wine"
                />
                {s.label}
              </label>
            ))}
          </div>
        </AccItem>

        <AccItem value="type" title="Product Type">
          <div className="space-y-2">
            {[
              { v: "", l: "All" },
              { v: "RTW", l: "Ready-to-Wear" },
              { v: "BESPOKE", l: "Bespoke" },
            ].map((o) => (
              <label key={o.l} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="type"
                  checked={type === o.v}
                  onChange={() => set({ type: o.v || null })}
                  className="accent-wine"
                />
                {o.l}
              </label>
            ))}
          </div>
        </AccItem>

        <AccItem value="price" title="Price Range (₦)">
          <PriceApply minP={minP} maxP={maxP} onApply={(a, b) => set({ minPrice: a, maxPrice: b })} />
        </AccItem>

        <AccItem value="size" title="Size">
          <div className="flex flex-wrap gap-2">
            {SIZES.map((sz) => {
              const on = sizes.split(",").includes(sz);
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => set({ sizes: toggleCsv(sizes, sz) || null })}
                  className={cn(
                    "rounded-sm border px-2 py-1 font-label text-[10px] uppercase tracking-wide",
                    on ? "border-wine bg-wine text-ivory" : "border-border text-charcoal hover:border-wine",
                  )}
                >
                  {sz}
                </button>
              );
            })}
          </div>
        </AccItem>

        <AccItem value="tags" title="Tags">
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tg) => {
              const on = tags.split(",").includes(tg);
              return (
                <button
                  key={tg}
                  type="button"
                  onClick={() => set({ tags: toggleCsv(tags, tg) || null })}
                  className={cn(
                    "rounded-sm border px-2 py-1 font-label text-[10px] uppercase tracking-wide",
                    on ? "border-wine bg-wine text-ivory" : "border-border text-charcoal hover:border-wine",
                  )}
                >
                  {tg}
                </button>
              );
            })}
          </div>
        </AccItem>

        <AccItem value="sale" title="Availability">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={sale}
              onChange={(e) => set({ sale: e.target.checked ? "true" : null })}
              className="accent-wine"
            />
            Show sale items only
          </label>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => set({ inStock: e.target.checked ? "true" : "false" })}
              className="accent-wine"
            />
            In stock only
          </label>
        </AccItem>
      </Accordion.Root>
    </aside>
  );
}

function PriceApply({
  minP,
  maxP,
  onApply,
}: {
  minP: string;
  maxP: string;
  onApply: (min: string, max: string) => void;
}) {
  const [a, setA] = useState(minP);
  const [b, setB] = useState(maxP);
  useEffect(() => {
    setA(minP);
    setB(maxP);
  }, [minP, maxP]);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="w-full rounded-sm border border-border bg-cream px-2 py-2 text-sm"
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
        <input
          className="w-full rounded-sm border border-border bg-cream px-2 py-2 text-sm"
          value={b}
          onChange={(e) => setB(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="font-label text-[10px] uppercase tracking-wider text-wine hover:underline"
        onClick={() => onApply(a, b)}
      >
        Apply range
      </button>
    </div>
  );
}

function AccItem({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Item value={value} className="border-b border-border">
      <Accordion.Header>
        <Accordion.Trigger className="flex w-full items-center justify-between py-3 font-label text-[11px] uppercase tracking-wider text-charcoal hover:text-wine">
          {title}
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden pb-4">
        {children}
      </Accordion.Content>
    </Accordion.Item>
  );
}
