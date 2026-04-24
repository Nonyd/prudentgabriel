import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/payments/paystack";

const bodySchema = z.object({
  orderId: z.string().min(1),
  guestEmail: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orderId, guestEmail } = parsed.data;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentStatus !== PaymentStatus.PENDING) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.userId) {
    if (session?.user?.id !== order.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const ge = guestEmail?.trim().toLowerCase();
    if (!ge || ge !== (order.guestEmail ?? "").toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const email = session?.user?.email ?? order.guestEmail ?? guestEmail;
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const appUrl = getPublicAppUrl();
  const callbackUrl = `${appUrl}/api/payment/paystack/verify?orderId=${encodeURIComponent(orderId)}`;

  const init = await initializeTransaction({
    email,
    amountKobo: Math.round(order.total * 100),
    reference: order.orderNumber,
    callbackUrl,
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
  });

  return NextResponse.json({ authorizationUrl: init.authorizationUrl, reference: init.reference });
}
