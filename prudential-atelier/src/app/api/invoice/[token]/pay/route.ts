import { NextRequest, NextResponse } from "next/server";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { initializeBespokeGatewayPayment } from "@/lib/atelier-payment";
import { remainingDepositNGN } from "@/lib/atelier-fx";
import { getOrderPaymentSummary, toNumber } from "@/lib/payments/ledger";
import { roundToKobo } from "@/lib/money";
import { findInvoiceByPublicToken } from "@/lib/capability-token-lookup";
import { CAPABILITY_EXPIRED_COPY } from "@/lib/capability-token";

const bodySchema = z.object({
  amount: z.union([z.literal("deposit"), z.literal("full"), z.number().positive()]),
  currency: z.enum(["NGN", "USD", "GBP"]),
  gateway: z.enum(["PAYSTACK", "FLUTTERWAVE", "STRIPE", "MONNIFY"]),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const limited = rateLimitOr429(req, "invoice-token-pay", 10, 15 * 60 * 1000);
  if (limited) return limited;

  const { token } = await ctx.params;
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

  const found = await findInvoiceByPublicToken(token);
  if (!found.ok) {
    if (found.reason === "expired") {
      return NextResponse.json({ error: CAPABILITY_EXPIRED_COPY.body }, { status: 410 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const inv = found.inv;
  if (inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.PAID || inv.status === InvoiceStatus.CANCELLED) {
    return NextResponse.json({ error: "This invoice cannot collect payment" }, { status: 400 });
  }
  if (!inv.quotationId) {
    return NextResponse.json({ error: "This invoice is not linked to a commission" }, { status: 400 });
  }

  const order = await prisma.bespokeOrder.findFirst({ where: { quotationId: inv.quotationId } });
  if (!order || order.balance <= 0) {
    return NextResponse.json({ error: "Nothing to pay" }, { status: 400 });
  }

  const summary = await getOrderPaymentSummary(order.id);
  const remainingDeposit = remainingDepositNGN({
    depositRequiredNGN: toNumber(summary.depositRequired),
    confirmedNGN: toNumber(summary.confirmed),
  });
  const remainingBalance = toNumber(summary.balance);
  let amountNGN =
    parsed.data.amount === "deposit"
      ? remainingDeposit || remainingBalance
      : parsed.data.amount === "full"
        ? remainingBalance
        : parsed.data.amount;
  amountNGN = Math.min(roundToKobo(amountNGN), roundToKobo(remainingBalance));

  const result = await initializeBespokeGatewayPayment({
    order,
    amountNGN,
    currency: parsed.data.currency,
    gateway: parsed.data.gateway,
    email: inv.clientEmail,
    name: inv.clientName,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
