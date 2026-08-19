import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toPublicTrackDto } from "@/lib/public-pii-dtos";
import { rateLimitOr429 } from "@/lib/rate-limit";

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const limited = rateLimitOr429(req, "track-token", 30, 15 * 60 * 1000);
  if (limited) return limited;

  const { token } = await params;

  const order = await prisma.bespokeOrder.findUnique({
    where: { trackingToken: token },
    select: {
      orderRef: true,
      status: true,
      currentStage: true,
      clientName: true,
      deliveryDate: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    { item: toPublicTrackDto(order) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
