"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDate, optimizeImageUrl } from "@/lib/utils";

type Article = {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featuredImage: string | null;
  category: string | null;
  publishedAt: string | null;
  authorName: string | null;
  readTime: number | null;
};

type Related = {
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  publishedAt: string | null;
  readTime: number | null;
};

export function JournalArticleClient({ slug }: { slug: string }) {
  const [item, setItem] = useState<Article | null>(null);
  const [related, setRelated] = useState<Related[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/blog/public/${slug}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { item: Article; related: Related[] };
      setItem(data.item);
      setRelated(data.related);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-site px-6 py-20">
        <p className="font-sans text-sm text-text-mid">Loading article…</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-site px-6 py-20 text-center">
        <h1 className="font-serif text-3xl text-choc">Article not found</h1>
        <Link href="/journal" className="btn-ghost-light mt-8 inline-flex">
          Back to Journal
        </Link>
      </div>
    );
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <article className="mx-auto max-w-site px-6 py-16 lg:px-10">
      <Link
        href="/journal"
        className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-nut hover:underline"
      >
        ← Back to Journal
      </Link>

      {item.featuredImage ? (
        <div className="relative mt-8 img-portrait overflow-hidden rounded-lg bg-sand/20">
          <img
            src={optimizeImageUrl(item.featuredImage, 1200)}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <header className="mx-auto mt-10 max-w-3xl text-center">
        {item.category ? (
          <span className="inline-block rounded-full bg-choc/10 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-choc">
            {item.category}
          </span>
        ) : null}
        <h1 className="mt-4 font-serif text-[clamp(2rem,4vw,2.625rem)] font-medium leading-tight text-choc">
          {item.title}
        </h1>
        <p className="mt-4 font-sans text-xs text-text-light">
          {item.authorName ?? "Prudent Gabriel"}
          {item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ""}
          {item.readTime ? ` · ${item.readTime} min read` : ""}
        </p>
      </header>

      <div
        className="prose prose-sm mx-auto mt-10 max-w-3xl font-body text-text-mid prose-headings:font-serif prose-headings:text-choc prose-a:text-nut"
        dangerouslySetInnerHTML={{ __html: item.content }}
      />

      <div className="mx-auto mt-12 flex max-w-3xl flex-wrap gap-3 border-t border-sand pt-8">
        <button
          type="button"
          className="btn-ghost-light text-[10px]"
          onClick={() => {
            void navigator.clipboard.writeText(shareUrl);
          }}
        >
          Copy link
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${item.title} ${shareUrl}`)}`}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost-light text-[10px]"
        >
          WhatsApp
        </a>
      </div>

      {related.length > 0 ? (
        <section className="mt-16 border-t border-sand pt-12">
          <h2 className="font-serif text-2xl font-medium text-choc">Related stories</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {related.map((r) => (
              <Link key={r.slug} href={`/journal/${r.slug}`} className="group">
                {r.featuredImage ? (
                  <img
                    src={optimizeImageUrl(r.featuredImage, 400)}
                    alt=""
                    className="aspect-[4/3] w-full rounded object-cover"
                  />
                ) : null}
                <h3 className="mt-3 font-serif text-lg text-choc group-hover:text-nut">{r.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
