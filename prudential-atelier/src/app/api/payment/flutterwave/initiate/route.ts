import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { getExchangeRates, convertFromNGN } from "@/lib/currency";
import { initializeTransaction } from "@/lib/payments/flutterwave";

const bodySchema = z.object({
  orderId: z.string().min(1),
  currency: z.enum(["NGN", "USD", "GBP"]),
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

  const { orderId, currency, guestEmail } = parsed.data;
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

  const rates = await getExchangeRates();
  let amount = order.total;
  if (currency === "USD") {
    amount = Math.round(convertFromNGN(order.total, "USD", rates) * 100) / 100;
  } else if (currency === "GBP") {
    amount = Math.round(convertFromNGN(order.total, "GBP", rates) * 100) / 100;
  }

  const email = session?.user?.email ?? order.guestEmail ?? guestEmail ?? "";
  const name =
    session?.user?.name ??
    order.guestName ??
    (email ? email.split("@")[0] : "Customer");

  const appUrl = getPublicAppUrl();
  const redirectUrl = `${appUrl}/api/payment/flutterwave/verify?orderId=${encodeURIComponent(orderId)}`;

  const init = await initializeTransaction({
    txRef: order.orderNumber,
    amount,
    currency,
    email,
    name,
    phone: order.guestPhone ?? undefined,
    redirectUrl,
    meta: { orderId: order.id },
  });

  return NextResponse.json({ paymentLink: init.paymentLink });
}
