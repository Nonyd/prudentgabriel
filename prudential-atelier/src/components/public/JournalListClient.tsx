"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDate, optimizeImageUrl } from "@/lib/utils";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  category: string | null;
  publishedAt: string | null;
  authorName: string | null;
  readTime: number | null;
};

export function JournalListClient() {
  const [items, setItems] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "9" });
    if (category !== "all") params.set("category", category);
    const res = await fetch(`/api/blog/public?${params}`);
    if (res.ok) {
      const data = (await res.json()) as { items: BlogPost[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, category]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categories = Array.from(
    new Set(items.map((i) => i.category).filter(Boolean) as string[]),
  );
  const featured = page === 1 ? items[0] : null;
  const gridItems = page === 1 ? items.slice(1) : items;
  const totalPages = Math.max(1, Math.ceil(total / 9));

  return (
    <div className="mx-auto max-w-site px-6 py-20 lg:px-10">
      <p className="eyebrow">The Journal</p>
      <h1 className="mt-3 font-serif text-[clamp(2rem,4vw,3rem)] font-medium text-choc">
        Style &amp; Stories
      </h1>
      <p className="mt-4 max-w-xl copy-body text-sm font-light leading-relaxed text-text-mid">
        Stories from the atelier, styling notes, and behind-the-scenes craft.
      </p>

      {categories.length > 0 ? (
        <div className="mt-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setCategory("all");
            }}
            className={`rounded-full px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] ${
              category === "all" ? "bg-choc text-cream" : "border border-sand text-text-mid"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setPage(1);
                setCategory(c);
              }}
              className={`rounded-full px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] ${
                category === c ? "bg-choc text-cream" : "border border-sand text-text-mid"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-12 font-sans text-sm text-text-mid">Loading stories…</p>
      ) : items.length === 0 ? (
        <p className="mt-12 font-sans text-sm text-text-mid">No published posts yet.</p>
      ) : (
        <>
          {featured ? (
            <Link
              href={`/journal/${featured.slug}`}
              className="group mt-12 grid grid-cols-1 gap-0 overflow-hidden rounded-lg border border-sand bg-ivory/40 md:grid-cols-2"
            >
              {featured.featuredImage ? (
                <div className="relative min-h-[280px] overflow-hidden bg-sand/20 md:min-h-0 md:aspect-auto md:h-full">
                  <img
                    src={optimizeImageUrl(featured.featuredImage, 900)}
                    alt=""
                    className="h-full min-h-[280px] w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 md:absolute md:inset-0 md:min-h-0"
                  />
                </div>
              ) : null}
              <div className="flex flex-col justify-center p-8 md:p-10 lg:p-12">
                {featured.category ? (
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-lightbr">
                    {featured.category}
                  </span>
                ) : null}
                <h2 className="mt-3 font-serif text-3xl font-medium text-choc group-hover:text-nut">
                  {featured.title}
                </h2>
                {featured.excerpt ? (
                  <p className="mt-4 copy-body text-sm font-light leading-relaxed text-text-mid">
                    {featured.excerpt}
                  </p>
                ) : null}
                <p className="mt-6 font-sans text-xs text-text-light">
                  {featured.authorName ?? "Prudent Gabriel"}
                  {featured.publishedAt ? ` · ${formatDate(featured.publishedAt)}` : ""}
                  {featured.readTime ? ` · ${featured.readTime} min read` : ""}
                </p>
              </div>
            </Link>
          ) : null}

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {gridItems.map((post) => (
              <Link
                key={post.id}
                href={`/journal/${post.slug}`}
                className="group overflow-hidden rounded-lg border border-sand bg-ivory/30"
              >
                {post.featuredImage ? (
                  <div className="img-portrait relative overflow-hidden bg-sand/20">
                    <img
                      src={optimizeImageUrl(post.featuredImage, 600)}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="img-portrait bg-sand/20" />
                )}
                <div className="p-5">
                  {post.category ? (
                    <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-lightbr">
                      {post.category}
                    </span>
                  ) : null}
                  <h3 className="mt-2 font-serif text-xl font-medium text-choc group-hover:text-nut">
                    {post.title}
                  </h3>
                  {post.excerpt ? (
                    <p className="mt-2 line-clamp-2 copy-body text-xs font-light text-text-mid">
                      {post.excerpt}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="mt-12 flex justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-ghost-light disabled:opacity-40"
              >
                Previous
              </button>
              <span className="flex items-center font-sans text-xs text-text-mid">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-ghost-light disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
