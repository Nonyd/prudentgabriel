"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { Skeleton } from "@/components/ui/Skeleton";
import { convertFromNGN, formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ProductListItem } from "@/types/product";

const RECENT_KEY = "pa-recent-searches";

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  const prev = loadRecent().filter((x) => x.toLowerCase() !== t.toLowerCase());
  const next = [t, ...prev].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function SearchModal() {
  const router = useRouter();
  const isOpen = useCartStore((s) => s.isSearchOpen);
  const closeSearch = useCartStore((s) => s.closeSearch);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProductListItem[]>([]);
  const [featured, setFeatured] = useState<ProductListItem[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);

  const fmt = useCallback(
    (ngn: number) => formatPrice(convertFromNGN(ngn, currency, rates), currency),
    [currency, rates],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!isOpen) return;
    setRecent(loadRecent());
    fetch("/api/products?featured=true&limit=4&isPublished=true")
      .then((r) => r.json())
      .then((j) => setFeatured(j.products ?? []))
      .catch(() => setFeatured([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || debounced.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/products?search=${encodeURIComponent(debounced)}&limit=6&isPublished=true`,
    )
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setResults(j.products ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeSearch]);

  const showRecent = q.length === 0 && recent.length > 0;
  const showFeatured = q.length === 0 && recent.length === 0 && featured.length > 0;
  const showResults = q.trim().length >= 2;

  const lowest = (p: ProductListItem) =>
    Math.min(...p.variants.map((v) => (v.salePriceNGN != null ? v.salePriceNGN : v.priceNGN)));

  const goProduct = (slug: string, query?: string) => {
    if (query) saveRecent(query);
    closeSearch();
    setQ("");
    router.push(`/shop/${slug}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] bg-[var(--white)]/98 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close search"
            onClick={closeSearch}
          />
          <div
            className="relative mx-auto max-h-[85vh] max-w-2xl overflow-y-auto overscroll-contain px-4 pb-8 pt-20"
            data-lenis-prevent
          >
            <button
              type="button"
              onClick={closeSearch}
              className="absolute right-4 top-6 text-charcoal hover:text-olive"
              aria-label="Close search"
            >
              <X className="h-6 w-6" />
            </button>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for a piece..."
              className="h-14 w-full border-0 border-b border-mid-grey bg-transparent font-display text-2xl italic text-charcoal placeholder:text-dark-grey focus:border-olive focus:outline-none focus:ring-0 md:text-[32px]"
            />

            {showRecent && (
              <div className="mt-10">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-body text-[11px] font-medium uppercase tracking-[0.2em] text-dark-grey">
                    RECENT SEARCHES
                  </span>
                  <button
                    type="button"
                    className="font-body text-[10px] font-medium uppercase tracking-wider text-olive hover:underline"
                    onClick={() => {
                      localStorage.removeItem(RECENT_KEY);
                      setRecent([]);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setQ(r)}
                      className="border border-mid-grey px-3 py-1.5 font-body text-sm text-charcoal hover:border-olive"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showFeatured && (
              <div className="mt-10">
                <span className="font-body text-[11px] font-medium uppercase tracking-[0.2em] text-dark-grey">
                  FEATURED PIECES
                </span>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {featured.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => goProduct(p.slug)}
                      className="text-left"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-light-grey">
                        {p.images[0] && (
                          <Image
                            src={p.images[0].url}
                            alt={p.name}
                            fill
                            className="object-cover object-top"
                            sizes="150px"
                          />
                        )}
                      </div>
                      <p className="mt-2 font-body text-sm text-charcoal line-clamp-1">{p.name}</p>
                      <p className="text-xs text-dark-grey">{fmt(lowest(p))}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showResults && (
              <div className="mt-8">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="h-[60px] w-12 shrink-0 rounded-sm" />
                        <div className="flex-1 space-y-2 pt-2">
                          <Skeleton className="h-4 w-[75%]" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : results.length === 0 ? (
                  <p className="italic text-dark-grey">No pieces found for &apos;{debounced}&apos;</p>
                ) : (
                  <ul className="space-y-3">
                    {results.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => goProduct(p.slug, debounced)}
                          className="flex w-full gap-3 p-2 text-left transition-colors hover:bg-light-grey"
                        >
                          <div className="relative h-[60px] w-12 shrink-0 overflow-hidden bg-light-grey">
                            {p.images[0] && (
                              <Image
                                src={p.images[0].url}
                                alt=""
                                fill
                                className="object-cover object-top"
                                sizes="48px"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-body text-sm text-charcoal line-clamp-1">{p.name}</p>
                            <BadgeGold>{String(p.category).replace(/_/g, " ")}</BadgeGold>
                          </div>
                          <span className="shrink-0 text-sm text-olive">{fmt(lowest(p))}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BadgeGold({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 inline-block font-body text-[9px] font-medium uppercase tracking-wider text-olive">
      {children}
    </span>
  );
}
