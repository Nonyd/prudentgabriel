import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uniqueProductCountForCollection } from "@/lib/collection-products";

const CACHE = "public, s-maxage=300, stale-while-revalidate=600";

export async function GET() {
  try {
    const rows = await prisma.collection.findMany({
      where: { isPublished: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });

    const counts = await Promise.all(
      rows.map((c) => uniqueProductCountForCollection(c.id, c.autoTag)),
    );

    const collections = rows.map((c, i) => ({
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
      productCount: counts[i] ?? 0,
    }));

    return NextResponse.json({ collections }, { headers: { "Cache-Control": CACHE } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load collections" }, { status: 500 });
  }
}
