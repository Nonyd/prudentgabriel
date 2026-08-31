import { NextRequest, NextResponse } from "next/server";
import { PaymentPurpose, Prisma, ShippingQuoteStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { recomputeRtwOrderTotals } from "@/lib/payments/rtw-totals";
import { sendShippingQuoteEmail } from "@/lib/email";
import { generatePaymentReference } from "@/lib/payments/index";
import { getBankTransferDetails } from "@/lib/payments/config";
import { getPublicAppUrl } from "@/lib/app-url";
import { applyShippingQuoteToLocked, lockedFxFromOrder } from "@/lib/fx";

const bodySchema = z.object({
  amountNGN: z.number().min(0),
  carrier: z.string().min(1).max(80),
  note: z.string().max(1000).optional(),
  notify: z.boolean().optional().default(true),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.orders");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.shippingQuoteStatus !== ShippingQuoteStatus.QUOTE_PENDING && order.shippingQuoteStatus !== ShippingQuoteStatus.QUOTED) {
    return NextResponse.json({ error: "This order is not awaiting a shipping quote" }, { status: 400 });
  }

  const nextShipping = parsed.data.amountNGN;
  const delta = nextShipping - order.shippingAmount;
  const nextTotal = Math.max(0, order.total + delta);
  const fx = lockedFxFromOrder(order);
  const usdLocked = applyShippingQuoteToLocked(order.fxUsdAmountLocked, delta, "USD", fx);
  const gbpLocked = applyShippingQuoteToLocked(order.fxGbpAmountLocked, delta, "GBP", fx);
  const prevLocked = (order.shippingQuoteLocked as Record<string, unknown> | null) ?? {};
  const agreedCarrier = parsed.data.carrier.trim();

  const updated = await prisma.order.update({
    where: { id },
    data: {
      shippingAmount: nextShipping,
      total: nextTotal,
      shippingQuoteStatus: ShippingQuoteStatus.QUOTED,
      carrier: agreedCarrier,
      shippingQuoteNote: parsed.data.note?.trim() || null,
      shippingQuoteLocked: {
        ...prevLocked,
        pending: false,
        amountNGN: nextShipping,
        carrier: agreedCarrier,
        note: parsed.data.note?.trim() || null,
        quotedAt: new Date().toISOString(),
        quotedBy: gate.session.user?.id ?? null,
        purpose: PaymentPurpose.BALANCE,
      } as Prisma.InputJsonValue,
      ...(usdLocked != null ? { fxUsdAmountLocked: usdLocked } : {}),
      ...(gbpLocked != null ? { fxGbpAmountLocked: gbpLocked } : {}),
    },
  });

  const summary = await recomputeRtwOrderTotals(id);
  const email = order.guestEmail ?? (order.userId
    ? (await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true } }))?.email
    : null);

  if (parsed.data.notify && email) {
    const bank = await getBankTransferDetails(order.currency === "USD" ? "USD" : "NGN");
    const ref = order.paymentRef ?? generatePaymentReference("SHIP");
    if (!order.paymentRef) {
      await prisma.order.update({ where: { id }, data: { paymentRef: ref } });
    }
    const firstName = (order.guestName ?? "there").split(" ")[0] ?? "there";
    await sendShippingQuoteEmail({
      to: email,
      firstName,
      orderNumber: order.orderNumber,
      amountNGN: nextShipping,
      currency: String(order.currency),
      paymentRef: ref,
      bank,
      payUrl: `${getPublicAppUrl()}/account/orders/${order.id}`,
    });
  }

  return NextResponse.json({
    order: updated,
    balance: Number(summary.balance),
  });
}
