import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getSupportedGateways } from "@/lib/payments/config";
import { getBespokeOrderForUser } from "@/lib/bespoke-order-access";
import { initializeBespokeGatewayPayment } from "@/lib/atelier-payment";

const bodySchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["NGN", "USD", "GBP"]),
  gateway: z.enum(["PAYSTACK", "FLUTTERWAVE", "STRIPE", "MONNIFY", "BANK_TRANSFER"]),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await ctx.params;
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

  const { amount, currency, gateway } = parsed.data;
  if (gateway === "BANK_TRANSFER") {
    return NextResponse.json({ error: "Use the bank-transfer route for receipts" }, { status: 400 });
  }

  const offered = await getSupportedGateways(currency, "ATELIER");
  if (!offered.includes(gateway)) {
    return NextResponse.json({ error: "That payment method is not available for this currency" }, { status: 400 });
  }

  const order = await getBespokeOrderForUser(orderId, session.user.id);
  if (!order || order.balance <= 0) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const result = await initializeBespokeGatewayPayment({
    order,
    amountNGN: amount,
    currency,
    gateway,
    email: session.user.email,
    name: session.user.name ?? session.user.email.split("@")[0] ?? "Client",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
