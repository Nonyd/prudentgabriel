import { NextRequest, NextResponse } from "next/server";
import { listPublishedJournalPosts, toJournalListJson } from "@/lib/journal";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const listed = await listPublishedJournalPosts({
      category: searchParams.get("category"),
      page: Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
      limit: Number.parseInt(searchParams.get("limit") ?? "9", 10) || 9,
    });
    return NextResponse.json({
      items: listed.items.map(toJournalListJson),
      total: listed.total,
      page: listed.page,
      limit: listed.limit,
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BLOG_PUBLIC_LIST",
      message: e instanceof Error ? e.message : "Failed to list public blog posts",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
