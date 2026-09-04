import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { standardVariants } from "@/lib/custom-size";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("productIds") ?? "";
  const ids = Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))).slice(0, 40);
  if (!ids.length) return NextResponse.json({ products: {} });

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, isPublished: true },
    select: {
      id: true,
      isOnSale: true,
      variants: {
        orderBy: { priceNGN: "asc" },
        select: {
          id: true,
          size: true,
          stock: true,
          priceNGN: true,
          salePriceNGN: true,
          priceUSD: true,
          priceGBP: true,
        },
      },
    },
  });

  const map: Record<
    string,
    {
      isOnSale: boolean;
      variants: {
        id: string;
        size: string;
        stock: number;
        priceNGN: number;
        salePriceNGN: number | null;
        priceUSD: number | null;
        priceGBP: number | null;
      }[];
    }
  > = {};

  for (const p of products) {
    map[p.id] = {
      isOnSale: p.isOnSale,
      variants: standardVariants(p.variants),
    };
  }

  return NextResponse.json({ products: map });
}
