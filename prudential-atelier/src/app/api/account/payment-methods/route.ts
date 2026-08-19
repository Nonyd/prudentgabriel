import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { PaymentGateway } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPaystackSecret, getStripeSecret } from "@/lib/payments/config";

function toSafeMethod(method: {
  id: string;
  gateway: PaymentGateway;
  paystackCardLast4: string | null;
  paystackCardBrand: string | null;
  paystackCardExpiry: string | null;
  stripeCardLast4: string | null;
  stripeCardBrand: string | null;
  stripeCardExpiry: string | null;
  isDefault: boolean;
  nickname: string | null;
  createdAt: Date;
}) {
  return {
    id: method.id,
    gateway: method.gateway,
    cardLast4: method.paystackCardLast4 ?? method.stripeCardLast4,
    cardBrand: method.paystackCardBrand ?? method.stripeCardBrand,
    cardExpiry: method.paystackCardExpiry ?? method.stripeCardExpiry,
    isDefault: method.isDefault,
    nickname: method.nickname,
    createdAt: method.createdAt,
  };
}

const bodySchema = z.discriminatedUnion("gateway", [
  z.object({
    gateway: z.literal("PAYSTACK"),
    isDefault: z.boolean().optional(),
    nickname: z.string().optional(),
  }),
  z.object({
    gateway: z.literal("STRIPE"),
    paymentMethodId: z.string().min(3),
    isDefault: z.boolean().optional(),
    nickname: z.string().optional(),
  }),
]);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const methods = await prisma.savedPaymentMethod.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ methods: methods.map(toSafeMethod) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (parsed.data.gateway === "PAYSTACK") {
    const secret = await getPaystackSecret();
    if (!secret) return NextResponse.json({ error: "Paystack not configured" }, { status: 400 });

    const verifyRes = await fetch(`https://api.paystack.co/customer/${encodeURIComponent(user.email)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!verifyRes.ok) {
      return NextResponse.json({ error: "Unable to verify Paystack customer" }, { status: 400 });
    }
    const payload = (await verifyRes.json()) as {
      data?: {
        authorizations?: Array<{
          authorization_code?: string;
          last4?: string;
          brand?: string;
          exp_month?: string;
          exp_year?: string;
          reusable?: boolean;
        }>;
      };
    };
    const authz = payload.data?.authorizations?.find((a) => a.reusable && a.authorization_code);
    if (!authz?.authorization_code) {
      return NextResponse.json({ error: "No reusable Paystack authorization found" }, { status: 400 });
    }
    const expiry =
      authz.exp_month && authz.exp_year ? `${authz.exp_month}/${authz.exp_year}` : "";

    if (parsed.data.isDefault) {
      await prisma.savedPaymentMethod.updateMany({
        where: { userId: session.user.id },
        data: { isDefault: false },
      });
    }

    const method = await prisma.savedPaymentMethod.create({
      data: {
        userId: session.user.id,
        gateway: "PAYSTACK",
        paystackAuthCode: authz.authorization_code,
        paystackCardLast4: authz.last4 ?? null,
        paystackCardBrand: authz.brand ?? null,
        paystackCardExpiry: expiry || null,
        paystackEmail: user.email,
        nickname: parsed.data.nickname ?? null,
        isDefault: Boolean(parsed.data.isDefault),
      },
    });

    return NextResponse.json({ success: true, method: toSafeMethod(method) });
  }

  const stripeKey = await getStripeSecret();
  if (!stripeKey) return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  const stripe = new Stripe(stripeKey);

  const customer = await stripe.customers.create({ email: user.email });
  await stripe.paymentMethods.attach(parsed.data.paymentMethodId, { customer: customer.id });
  const pm = await stripe.paymentMethods.retrieve(parsed.data.paymentMethodId);
  const card = pm.card;
  const last4 = card?.last4 ?? null;
  const brand = card?.brand ?? null;
  const expiry = card?.exp_month && card?.exp_year ? `${card.exp_month}/${card.exp_year}` : null;

  if (parsed.data.isDefault) {
    await prisma.savedPaymentMethod.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });
  }

  const method = await prisma.savedPaymentMethod.create({
    data: {
      userId: session.user.id,
      gateway: "STRIPE",
      stripePaymentMethodId: parsed.data.paymentMethodId,
      stripeCardLast4: last4,
      stripeCardBrand: brand,
      stripeCardExpiry: expiry,
      stripeCustomerId: customer.id,
      nickname: parsed.data.nickname ?? null,
      isDefault: Boolean(parsed.data.isDefault),
    },
  });

  return NextResponse.json({ success: true, method: toSafeMethod(method) });
}
