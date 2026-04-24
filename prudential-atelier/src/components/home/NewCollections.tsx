"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { convertFromNGN, formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ProductListItem } from "@/types/product";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='1067'%3E%3Crect width='100%25' height='100%25' fill='%23F2F2F0'/%3E%3C/svg%3E";

function effectivePrice(v: ProductListItem["variants"][0]) {
  return v.salePriceNGN != null ? v.salePriceNGN : v.priceNGN;
}

function ProductCell({
  product,
  className,
  tall,
}: {
  product: ProductListItem;
  className?: string;
  tall?: boolean;
}) {
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const img = product.images[0];
  const prices = product.variants.map((v) => effectivePrice(v));
  const low = Math.min(...prices);
  const multi = product.variants.length > 1;
  const fmt = formatPrice(convertFromNGN(low, currency, rates), currency);

  return (
    <Link
      href={`/shop/${product.slug}`}
      className={`group relative block overflow-hidden bg-light-grey ${className ?? ""}`}
    >
      <div className={tall ? "aspect-[3/4]" : "aspect-square"}>
        <Image
          src={img?.url ?? PLACEHOLDER}
          alt={img?.alt || product.name}
          fill
          className="object-cover object-top transition-transform duration-[600ms] ease-out group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 translate-y-full bg-white p-4 transition-transform duration-[350ms] ease-out group-hover:translate-y-0">
        <p className="font-body text-[13px] font-normal text-charcoal line-clamp-1">{product.name}</p>
        <p className="mt-0.5 font-body text-[12px] font-light text-dark-grey">
          {multi ? "From " : ""}
          {fmt}
        </p>
        <span className="mt-2 inline-block font-body text-[10px] font-medium uppercase tracking-[0.12em] text-olive">
          Select options
        </span>
      </div>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-12 grid grid-cols-2 gap-px md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2 md:gap-px">
      <div className="aspect-[3/4] animate-pulse bg-light-grey md:row-span-2" />
      <div className="aspect-square animate-pulse bg-light-grey" />
      <div className="aspect-square animate-pulse bg-light-grey" />
      <div className="aspect-square animate-pulse bg-light-grey max-md:hidden" />
      <div className="aspect-square animate-pulse bg-light-grey max-md:hidden" />
    </div>
  );
}

export function NewCollections() {
  const [products, setProducts] = useState<ProductListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products?isNewArrival=true&limit=5")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setProducts(j.products ?? []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const list = products ?? [];
  const [a, b, c, d, e] = list;

  return (
    <section className="bg-white py-[100px]">
      <div className="mx-auto flex max-w-[1400px] items-end justify-between px-6 md:px-8">
        <span className="font-body text-[10px] font-medium uppercase tracking-[0.25em] text-olive">Ready to Wear</span>
        <span className="hidden w-8 md:block" />
        <Link
          href="/shop"
          className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-charcoal underline decoration-charcoal underline-offset-4 transition-colors hover:text-olive hover:decoration-olive"
        >
          View all collections →
        </Link>
      </div>

      {products === null ? (
        <div className="mx-auto max-w-[1400px] px-6 md:px-8">
          <SkeletonGrid />
        </div>
      ) : list.length === 0 ? (
        <p className="mx-auto mt-12 max-w-[1400px] px-6 text-center font-body text-dark-grey md:px-8">
          New arrivals will appear here soon.
        </p>
      ) : (
        <div className="mx-auto mt-12 grid max-w-[1400px] grid-cols-2 gap-px px-6 md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2 md:gap-px md:px-8">
          {a && (
            <ProductCell product={a} tall className="md:col-span-1 md:row-span-2" />
          )}
          {b && <ProductCell product={b} className="md:col-start-2 md:row-start-1" />}
          {c && <ProductCell product={c} className="md:col-start-3 md:row-start-1" />}
          {d && <ProductCell product={d} className="md:col-start-2 md:row-start-2 max-md:hidden" />}
          {e && <ProductCell product={e} className="md:col-start-3 md:row-start-2 max-md:hidden" />}
        </div>
      )}
    </section>
  );
}
