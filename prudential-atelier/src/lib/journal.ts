import { BlogStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSkipDbBuild } from "@/lib/skip-db-build";

export type JournalListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  category: string | null;
  tags: string[];
  publishedAt: Date | null;
  authorName: string | null;
  readTime: number | null;
};

export type JournalArticle = JournalListItem & {
  content: string;
  metaTitle: string | null;
  metaDesc: string | null;
  ogImage: string | null;
  updatedAt: Date;
};

function publishedWhere() {
  return {
    status: BlogStatus.PUBLISHED,
    publishedAt: { lte: new Date() },
  };
}

export async function listPublishedJournalPosts(opts?: {
  page?: number;
  limit?: number;
  category?: string | null;
}): Promise<{ items: JournalListItem[]; total: number; page: number; limit: number }> {
  if (isSkipDbBuild()) return { items: [], total: 0, page: 1, limit: 9 };
  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 9));
  const category = opts?.category?.trim();
  const where = {
    ...publishedWhere(),
    ...(category && category !== "all" ? { category } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        category: true,
        tags: true,
        publishedAt: true,
        authorName: true,
        readTime: true,
      },
    }),
  ]);
  return { items, total, page, limit };
}

export async function getPublishedJournalPost(slug: string): Promise<{
  item: JournalArticle;
  related: JournalListItem[];
} | null> {
  if (isSkipDbBuild()) return null;
  const item = await prisma.blogPost.findFirst({
    where: { slug, ...publishedWhere() },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      featuredImage: true,
      category: true,
      tags: true,
      publishedAt: true,
      authorName: true,
      readTime: true,
      metaTitle: true,
      metaDesc: true,
      ogImage: true,
      updatedAt: true,
    },
  });
  if (!item) return null;

  const related = item.category
    ? await prisma.blogPost.findMany({
        where: {
          category: item.category,
          ...publishedWhere(),
          NOT: { id: item.id },
        },
        orderBy: { publishedAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          featuredImage: true,
          category: true,
          tags: true,
          publishedAt: true,
          authorName: true,
          readTime: true,
        },
      })
    : [];

  return { item, related };
}

export type JournalListItemJson = Omit<JournalListItem, "publishedAt"> & { publishedAt: string | null };

export type JournalArticleJson = Omit<JournalArticle, "publishedAt" | "updatedAt"> & {
  publishedAt: string | null;
  updatedAt: string;
};

export function toJournalListJson(item: JournalListItem): JournalListItemJson {
  return { ...item, publishedAt: item.publishedAt?.toISOString() ?? null };
}

export function toJournalArticleJson(item: JournalArticle): JournalArticleJson {
  return {
    ...item,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    updatedAt: item.updatedAt.toISOString(),
  };
}
