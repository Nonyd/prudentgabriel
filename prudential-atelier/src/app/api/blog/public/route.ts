import { NextRequest, NextResponse } from "next/server";
import { BlogStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "9", 10) || 9));

    const where = {
      status: BlogStatus.PUBLISHED,
      publishedAt: { lte: new Date() },
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

    return NextResponse.json({ items, total, page, limit });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BLOG_PUBLIC_LIST",
      message: e instanceof Error ? e.message : "Failed to list public blog posts",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
