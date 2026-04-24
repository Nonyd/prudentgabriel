import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { queryProductList } from "@/lib/products-list-query";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const isAdmin =
      session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

    const { searchParams } = new URL(req.url);
    const result = await queryProductList(searchParams, { isAdmin });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}
