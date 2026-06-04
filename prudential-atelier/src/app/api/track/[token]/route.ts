import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  const order = await prisma.bespokeOrder.findUnique({
    where: { trackingToken: token },
    include: {
      stageHistory: { orderBy: { completedAt: "asc" } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    { item: order },
    { headers: { "Cache-Control": "no-store" } },
  );
}
