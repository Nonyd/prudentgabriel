import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  createShopCategory,
  listShopCategories,
  ShopCategoryError,
} from "@/lib/shop-categories";

export async function GET() {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const items = await listShopCategories();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const label = typeof body === "object" && body && "label" in body ? String((body as { label: unknown }).label) : "";
  try {
    const item = await createShopCategory(label);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof ShopCategoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
