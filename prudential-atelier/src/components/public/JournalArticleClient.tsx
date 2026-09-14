"use client";

import Link from "next/link";
import { formatDate, optimizeImageUrl } from "@/lib/utils";
import { sanitizeCmsHtml } from "@/lib/sanitize-html";
import type { JournalArticleJson, JournalListItemJson } from "@/lib/journal";
import { JournalShareBar } from "@/components/public/JournalShareBar";

export function JournalArticleClient({
  item,
  related,
  shareUrl,
}: {
  item: JournalArticleJson;
  related: JournalListItemJson[];
  shareUrl: string;
}) {
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
            alt={item.title}
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
        dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(item.content) }}
      />

      <JournalShareBar title={item.title} shareUrl={shareUrl} />

      {related.length > 0 ? (
        <section className="mt-16 border-t border-sand pt-12">
          <h2 className="font-serif text-2xl font-medium text-choc">Related stories</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {related.map((r) => (
              <Link key={r.slug} href={`/journal/${r.slug}`} className="group">
                {r.featuredImage ? (
                  <img
                    src={optimizeImageUrl(r.featuredImage, 400)}
                    alt={r.title}
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
