import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { PaymentGateway } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
    authCode: z.string().min(3),
    last4: z.string().min(1),
    brand: z.string().min(1),
    expiry: z.string().min(1),
    email: z.string().email(),
    isDefault: z.boolean().optional(),
    nickname: z.string().optional(),
  }),
  z.object({
    gateway: z.literal("STRIPE"),
    paymentMethodId: z.string().min(3),
    last4: z.string().min(1),
    brand: z.string().min(1),
    expiry: z.string().min(1),
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
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Paystack not configured" }, { status: 400 });

    const verifyRes = await fetch(`https://api.paystack.co/customer/${encodeURIComponent(parsed.data.email)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!verifyRes.ok) {
      return NextResponse.json({ error: "Unable to verify Paystack authorization code" }, { status: 400 });
    }

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
        paystackAuthCode: parsed.data.authCode,
        paystackCardLast4: parsed.data.last4,
        paystackCardBrand: parsed.data.brand,
        paystackCardExpiry: parsed.data.expiry,
        paystackEmail: parsed.data.email,
        nickname: parsed.data.nickname ?? null,
        isDefault: Boolean(parsed.data.isDefault),
      },
    });

    return NextResponse.json({ success: true, method: toSafeMethod(method) });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  const stripe = new Stripe(stripeKey);

  const customer = await stripe.customers.create({ email: user.email });
  await stripe.paymentMethods.attach(parsed.data.paymentMethodId, { customer: customer.id });

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
      stripeCardLast4: parsed.data.last4,
      stripeCardBrand: parsed.data.brand,
      stripeCardExpiry: parsed.data.expiry,
      stripeCustomerId: customer.id,
      nickname: parsed.data.nickname ?? null,
      isDefault: Boolean(parsed.data.isDefault),
    },
  });

  return NextResponse.json({ success: true, method: toSafeMethod(method) });
}
