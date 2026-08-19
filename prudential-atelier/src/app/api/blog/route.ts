import { NextRequest, NextResponse } from "next/server";
import { BlogStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CONTENT_ROLES, requireRoles } from "@/lib/api-auth";
import { slugifyText } from "@/lib/utils";
import { logActivity, logError } from "@/lib/logger";
import { revalidateJournal } from "@/lib/revalidate";

const STATUSES = new Set<string>(Object.values(BlogStatus));

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const baseSlug = slugifyText(base) || "post";
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix}`;
    const existing = await prisma.blogPost.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (!existing) return candidate;
    suffix += 1;
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireRoles(CONTENT_ROLES);
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();
    const category = searchParams.get("category");

    const where: Prisma.BlogPostWhereInput = {};
    if (status && status !== "all" && STATUSES.has(status)) {
      where.status = status as BlogStatus;
    }
    if (category && category !== "all") where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const items = await prisma.blogPost.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ items });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BLOG_LIST",
      message: e instanceof Error ? e.message : "Failed to list blog posts",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireRoles(CONTENT_ROLES);
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!title || !content) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  try {
    const slugInput = typeof body.slug === "string" ? body.slug : title;
    const slug = await uniqueSlug(slugInput);
    const status =
      typeof body.status === "string" && STATUSES.has(body.status)
        ? (body.status as BlogStatus)
        : BlogStatus.DRAFT;

    const publishedAt =
      status === BlogStatus.PUBLISHED
        ? body.publishedAt
          ? new Date(String(body.publishedAt))
          : new Date()
        : null;

    const authorId = gate.session.user.id;
    if (!authorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const item = await prisma.blogPost.create({
      data: {
        title,
        slug,
        content,
        excerpt: typeof body.excerpt === "string" ? body.excerpt : null,
        featuredImage: typeof body.featuredImage === "string" ? body.featuredImage : null,
        category: typeof body.category === "string" ? body.category : null,
        tags: Array.isArray(body.tags)
          ? body.tags.filter((t): t is string => typeof t === "string")
          : [],
        status,
        publishedAt,
        scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : null,
        metaTitle: typeof body.metaTitle === "string" ? body.metaTitle : null,
        metaDesc: typeof body.metaDesc === "string" ? body.metaDesc : null,
        ogImage: typeof body.ogImage === "string" ? body.ogImage : null,
        authorId,
        authorName: gate.session.user.name ?? gate.session.user.email ?? undefined,
        readTime: estimateReadTime(content),
      },
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "CREATE",
      module: "blog",
      description: `Created blog post "${title}"`,
      recordId: item.id,
      recordType: "BlogPost",
    });

    await revalidateJournal(item.slug);

    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BLOG_CREATE",
      message: e instanceof Error ? e.message : "Failed to create blog post",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
