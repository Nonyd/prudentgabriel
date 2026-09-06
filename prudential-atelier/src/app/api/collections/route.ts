import { NextResponse } from "next/server";
import { listLivePublishedCollections } from "@/lib/live-collections";

const CACHE = "public, s-maxage=300, stale-while-revalidate=600";

export async function GET() {
  try {
    const live = await listLivePublishedCollections();

    const collections = live.map(({ collection: c, productCount }) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      excerpt: c.excerpt,
      coverImage: c.coverImage,
      coverImageAlt: c.coverImageAlt,
      autoTag: c.autoTag,
      isFeatured: c.isFeatured,
      season: c.season,
      year: c.year,
      displayOrder: c.displayOrder,
      productCount,
    }));

    return NextResponse.json({ collections }, { headers: { "Cache-Control": CACHE } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load collections" }, { status: 500 });
  }
}
