import { NextResponse } from "next/server";
import { listStorefrontCategories } from "@/lib/shop-categories";

export async function GET() {
  const items = await listStorefrontCategories();
  return NextResponse.json({
    items: items.map((item) => ({ slug: item.slug, label: item.label })),
  });
}
