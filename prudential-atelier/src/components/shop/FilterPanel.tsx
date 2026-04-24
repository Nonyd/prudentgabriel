"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Accordion from "@radix-ui/react-accordion";
import * as Slider from "@radix-ui/react-slider";
import { ProductCategory } from "@prisma/client";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "featured", label: "Featured" },
];

const CATEGORIES: { value: ProductCategory | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: ProductCategory.BRIDAL, label: "Bridal" },
  { value: ProductCategory.EVENING_WEAR, label: "Evening Wear" },
  { value: ProductCategory.FORMAL, label: "Formal" },
  { value: ProductCategory.CASUAL, label: "Casual" },
  { value: ProductCategory.KIDDIES, label: "Kiddies" },
  { value: ProductCategory.ACCESSORIES, label: "Accessories" },
];

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "UK8", "UK10", "UK12", "Custom"];
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
  const category = sp.get("category") ?? "";
  const type = sp.get("type") ?? "";
  const tags = sp.get("tags") ?? "";
  const sizes = sp.get("sizes") ?? "";
  const sale = sp.get("sale") === "true";
  const minP = sp.get("minPrice") ?? "0";
  const maxP = sp.get("maxPrice") ?? "1000000";
  const inStock = sp.get("inStock") !== "false";

  const active =
    Boolean(category) ||
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
          <Link href="/shop" className="font-label text-[10px] uppercase tracking-wider text-olive hover:underline">
            Clear All
          </Link>
        )}
      </div>

      <Accordion.Root type="multiple" defaultValue={["sort", "category", "type", "price", "size", "tags", "sale"]}>
        <AccItem value="sort" title="Sort">
          <div className="space-y-2">
            {SORTS.map((s) => (
              <label key={s.value} className="flex cursor-pointer items-center gap-2 font-body text-[13px] text-charcoal">
                <input
                  type="radio"
                  name="sort"
                  checked={sort === s.value}
                  onChange={() => set({ sort: s.value })}
                  className="accent-olive"
                />
                {s.label}
              </label>
            ))}
          </div>
        </AccItem>

        <AccItem value="category" title="Category">
          <div className="space-y-2">
            {CATEGORIES.map((c) => (
              <label key={c.label} className="flex cursor-pointer items-center gap-2 font-body text-[13px] text-charcoal">
                <input
                  type="radio"
                  name="category"
                  checked={(category || "") === c.value}
                  onChange={() => set({ category: c.value || null })}
                  className="accent-olive"
                />
                {c.label}
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
                  className="accent-olive"
                />
                {o.l}
              </label>
            ))}
          </div>
        </AccItem>

        <AccItem value="price" title="Price Range (₦)">
          <PriceSlider minP={minP} maxP={maxP} onApply={(a, b) => set({ minPrice: a, maxPrice: b })} />
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
                    "border px-3 py-1 font-body text-[11px] uppercase tracking-wide",
                    on ? "border-olive bg-olive text-white" : "border-mid-grey text-charcoal hover:border-olive",
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
                    "border px-2 py-1 font-label text-[10px] uppercase tracking-wide",
                    on ? "border-olive bg-olive text-white" : "border-border text-charcoal hover:border-olive",
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
              className="accent-olive"
            />
            Show sale items only
          </label>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => set({ inStock: e.target.checked ? "true" : "false" })}
              className="accent-olive"
            />
            In stock only
          </label>
        </AccItem>
      </Accordion.Root>
    </aside>
  );
}

function PriceSlider({
  minP,
  maxP,
  onApply,
}: {
  minP: string;
  maxP: string;
  onApply: (min: string, max: string) => void;
}) {
  const minN = Math.max(0, Math.min(1_000_000, parseInt(minP, 10) || 0));
  const maxN = Math.max(minN, Math.min(1_000_000, parseInt(maxP, 10) || 1_000_000));
  const [range, setRange] = useState([minN, maxN]);
  useEffect(() => {
    setRange([minN, maxN]);
  }, [minN, maxN]);

  return (
    <div className="space-y-4">
      <p className="font-body text-[13px] text-charcoal">
        ₦{range[0].toLocaleString("en-NG")} — ₦{range[1].toLocaleString("en-NG")}
      </p>
      <Slider.Root
        className="relative flex h-5 w-full touch-none select-none items-center"
        min={0}
        max={1_000_000}
        step={10_000}
        value={range}
        onValueChange={(v) => setRange(v)}
        minStepsBetweenThumbs={1}
      >
        <Slider.Track className="relative h-1 grow rounded-full bg-mid-grey">
          <Slider.Range className="absolute h-full rounded-full bg-olive" />
        </Slider.Track>
        <Slider.Thumb
          className="block h-4 w-4 border border-olive bg-white focus:outline-none focus:ring-2 focus:ring-olive/40"
          aria-label="Minimum price"
        />
        <Slider.Thumb
          className="block h-4 w-4 border border-olive bg-white focus:outline-none focus:ring-2 focus:ring-olive/40"
          aria-label="Maximum price"
        />
      </Slider.Root>
      <button
        type="button"
        className="font-body text-[12px] text-dark-grey underline-offset-2 hover:text-olive hover:underline"
        onClick={() => onApply(String(range[0]), String(range[1]))}
      >
        Apply price range
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
        <Accordion.Trigger className="flex w-full items-center justify-between py-3 font-body text-[10px] uppercase tracking-[0.14em] text-dark-grey hover:text-olive">
          {title}
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden pb-4">
        {children}
      </Accordion.Content>
    </Accordion.Item>
  );
}
