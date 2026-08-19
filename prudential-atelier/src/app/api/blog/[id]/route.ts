import { NextRequest, NextResponse } from "next/server";
import { BlogStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CONTENT_ROLES, requireRoles } from "@/lib/api-auth";
import { slugifyText } from "@/lib/utils";
import { logActivity, logError } from "@/lib/logger";
import { revalidateJournal } from "@/lib/revalidate";

type Params = { params: Promise<{ id: string }> };

const STATUSES = new Set<string>(Object.values(BlogStatus));

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

async function uniqueSlug(base: string, excludeId: string): Promise<string> {
  const baseSlug = slugifyText(base) || "post";
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix}`;
    const existing = await prisma.blogPost.findFirst({
      where: { slug: candidate, NOT: { id: excludeId } },
    });
    if (!existing) return candidate;
    suffix += 1;
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(CONTENT_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const item = await prisma.blogPost.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BLOG_GET",
      message: e instanceof Error ? e.message : "Failed to fetch blog post",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(CONTENT_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Prisma.BlogPostUpdateInput = {};

    if (typeof body.title === "string") data.title = body.title.trim();
    if (typeof body.content === "string") {
      data.content = body.content;
      data.readTime = estimateReadTime(body.content);
    }
    if (typeof body.slug === "string" && body.slug.trim()) {
      data.slug = await uniqueSlug(body.slug, id);
    } else if (typeof body.title === "string" && body.title !== existing.title) {
      data.slug = await uniqueSlug(body.title, id);
    }
    if (typeof body.excerpt === "string") data.excerpt = body.excerpt;
    if (typeof body.featuredImage === "string") data.featuredImage = body.featuredImage || null;
    if (typeof body.category === "string") data.category = body.category || null;
    if (Array.isArray(body.tags)) {
      data.tags = body.tags.filter((t): t is string => typeof t === "string");
    }
    if (typeof body.metaTitle === "string") data.metaTitle = body.metaTitle || null;
    if (typeof body.metaDesc === "string") data.metaDesc = body.metaDesc || null;
    if (typeof body.ogImage === "string") data.ogImage = body.ogImage || null;
    if (body.scheduledAt !== undefined) {
      data.scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : null;
    }

    if (typeof body.status === "string" && STATUSES.has(body.status)) {
      const status = body.status as BlogStatus;
      data.status = status;
      if (status === BlogStatus.PUBLISHED && !existing.publishedAt) {
        data.publishedAt = body.publishedAt ? new Date(String(body.publishedAt)) : new Date();
      }
    } else if (body.publishedAt !== undefined) {
      data.publishedAt = body.publishedAt ? new Date(String(body.publishedAt)) : null;
    }

    const item = await prisma.blogPost.update({ where: { id }, data });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "UPDATE",
      module: "blog",
      description: `Updated blog post "${item.title}"`,
      recordId: item.id,
      recordType: "BlogPost",
    });

    await revalidateJournal(item.slug);

    return NextResponse.json({ item });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BLOG_PATCH",
      message: e instanceof Error ? e.message : "Failed to update blog post",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(CONTENT_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.blogPost.delete({ where: { id } });

    await revalidateJournal(existing.slug);

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "DELETE",
      module: "blog",
      description: `Deleted blog post "${existing.title}"`,
      recordId: id,
      recordType: "BlogPost",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BLOG_DELETE",
      message: e instanceof Error ? e.message : "Failed to delete blog post",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
