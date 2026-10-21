import { NextRequest, NextResponse } from "next/server";
import { toPublicTrackDto } from "@/lib/public-pii-dtos";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { findOrderByTrackingToken } from "@/lib/capability-token-lookup";
import { CAPABILITY_EXPIRED_COPY } from "@/lib/capability-token";
import { prisma } from "@/lib/prisma";
import { CLIENT_STEP_SELECT, clientSteps } from "@/lib/atelier/pipeline";
import { ensureSteps } from "@/lib/atelier/pipeline-db";

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const limited = await rateLimitOr429(req, "track-token", 30, 15 * 60 * 1000);
  if (limited) return limited;

  const { token } = await params;

  const found = await findOrderByTrackingToken(token);
  if (!found.ok) {
    if (found.reason === "expired") {
      return NextResponse.json({ error: CAPABILITY_EXPIRED_COPY.body }, { status: 410 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const order = found.order;
  await ensureSteps(prisma, order.id);
  const steps = await prisma.orderStage.findMany({
    where: { orderId: order.id },
    orderBy: { position: "asc" },
    select: CLIENT_STEP_SELECT,
  });
  return NextResponse.json(
    {
      item: toPublicTrackDto({
        orderRef: order.orderRef,
        status: order.status,
        currentStage: order.currentStage,
        clientName: order.clientName,
        deliveryDate: order.deliveryDate,
        steps: clientSteps(steps),
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
