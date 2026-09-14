import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JournalArticleClient } from "@/components/public/JournalArticleClient";
import { JsonLd } from "@/components/seo/JsonLd";
import { absolutePublicUrl } from "@/lib/app-url";
import { getPublishedJournalPost, toJournalArticleJson, toJournalListJson } from "@/lib/journal";
import { houseShareImage, pageMetadata } from "@/lib/seo";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo-jsonld";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublishedJournalPost(slug);
  if (!data) notFound();
  const { item } = data;
  return pageMetadata({
    title: item.metaTitle?.trim() || item.title,
    description:
      item.metaDesc?.trim() ||
      item.excerpt?.trim() ||
      `A story from the Prudential Atelier journal.`,
    path: `/journal/${item.slug}`,
    image: item.ogImage || item.featuredImage || (await houseShareImage()),
    imageAlt: item.title,
    type: "article",
  });
}

export default async function JournalArticlePage({ params }: Props) {
  const { slug } = await params;
  const data = await getPublishedJournalPost(slug);
  if (!data) notFound();

  const url = absolutePublicUrl(`/journal/${data.item.slug}`);
  const description =
    data.item.metaDesc?.trim() || data.item.excerpt?.trim() || data.item.title;

  return (
    <>
      <JsonLd
        data={articleJsonLd({
          title: data.item.title,
          description,
          url,
          image: data.item.ogImage || data.item.featuredImage,
          datePublished: data.item.publishedAt,
          dateModified: data.item.updatedAt,
          authorName: data.item.authorName,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Journal", path: "/journal" },
          { name: data.item.title, path: `/journal/${data.item.slug}` },
        ])}
      />
      <JournalArticleClient
        item={toJournalArticleJson(data.item)}
        related={data.related.map(toJournalListJson)}
        shareUrl={url}
      />
    </>
  );
}
