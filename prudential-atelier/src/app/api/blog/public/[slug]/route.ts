import { NextRequest, NextResponse } from "next/server";
import { getPublishedJournalPost, toJournalArticleJson, toJournalListJson } from "@/lib/journal";
import { logError } from "@/lib/logger";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;

  try {
    const data = await getPublishedJournalPost(slug);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      item: toJournalArticleJson(data.item),
      related: data.related.map(toJournalListJson),
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BLOG_PUBLIC_GET",
      message: e instanceof Error ? e.message : "Failed to fetch blog post",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
