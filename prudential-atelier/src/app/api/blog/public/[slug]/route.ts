import { NextRequest, NextResponse } from "next/server";
import { BlogStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;

  try {
    const item = await prisma.blogPost.findFirst({
      where: {
        slug,
        status: BlogStatus.PUBLISHED,
        publishedAt: { lte: new Date() },
      },
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
      },
    });

    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const related = item.category
      ? await prisma.blogPost.findMany({
          where: {
            category: item.category,
            status: BlogStatus.PUBLISHED,
            publishedAt: { lte: new Date() },
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
            publishedAt: true,
            readTime: true,
          },
        })
      : [];

    return NextResponse.json({ item, related });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BLOG_PUBLIC_GET",
      message: e instanceof Error ? e.message : "Failed to fetch blog post",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
