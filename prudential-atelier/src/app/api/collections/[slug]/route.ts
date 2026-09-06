import { NextRequest, NextResponse } from "next/server";
import {
  mergePublishedCollectionProducts,
  sortCollectionProducts,
} from "@/lib/collection-products";
import { findLivePublishedCollection } from "@/lib/live-collections";

const CACHE = "public, s-maxage=60, stale-while-revalidate=120";

function parsePage(sp: URLSearchParams): { page: number; limit: number; sort: string } {
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const limit = Math.min(48, Math.max(1, Number(sp.get("limit") ?? "24") || 24));
  const sort = (sp.get("sort") ?? "").trim();
  return { page, limit, sort };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const { page, limit, sort } = parsePage(req.nextUrl.searchParams);

    const collection = await findLivePublishedCollection(slug);

    if (!collection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const merged = await mergePublishedCollectionProducts(collection.id, collection.autoTag);
    const sorted = sortCollectionProducts(merged, sort);
    const total = sorted.length;
    const slice = sorted.slice((page - 1) * limit, page * limit);
    const hasNext = page * limit < total;

    const payload = {
      collection: {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        description: collection.description,
        excerpt: collection.excerpt,
        coverImage: collection.coverImage,
        coverImageAlt: collection.coverImageAlt,
        autoTag: collection.autoTag,
        season: collection.season,
        year: collection.year,
        metaTitle: collection.metaTitle,
        metaDescription: collection.metaDescription,
        updatedAt: collection.updatedAt.toISOString(),
      },
      products: slice,
      total,
      page,
      limit,
      hasNext,
      sort: sort || "curated",
    };

    return NextResponse.json(payload, { headers: { "Cache-Control": CACHE } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load collection" }, { status: 500 });
  }
}
