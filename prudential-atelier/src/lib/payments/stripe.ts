import Stripe from "stripe";
import { getStripeSecret, getStripeWebhookSecret } from "@/lib/payments/config";

async function getStripe(): Promise<Stripe> {
  const key = await getStripeSecret();
  if (!key) throw new Error("Stripe secret key is not configured");
  return new Stripe(key);
}

export async function createPaymentIntent(params: {
  amountCents: number;
  currency: "usd" | "gbp";
  orderId: string;
  orderNumber: string;
  customerEmail: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = await getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: params.currency,
    automatic_payment_methods: { enabled: true },
    metadata: { orderId: params.orderId, orderNumber: params.orderNumber },
    receipt_email: params.customerEmail,
  });

  const clientSecret = intent.client_secret;
  if (!clientSecret) throw new Error("Stripe did not return client_secret");

  return { clientSecret, paymentIntentId: intent.id };
}

export async function createConsultationPaymentIntent(params: {
  amountCents: number;
  currency: "usd" | "gbp";
  bookingId: string;
  bookingNumber: string;
  customerEmail: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = await getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: params.currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      consultationBookingId: params.bookingId,
      bookingNumber: params.bookingNumber,
      type: "consultation",
    } as Record<string, string>,
    receipt_email: params.customerEmail,
  });

  const clientSecret = intent.client_secret;
  if (!clientSecret) throw new Error("Stripe did not return client_secret");

  return { clientSecret, paymentIntentId: intent.id };
}

export async function createBespokePaymentIntent(params: {
  amountCents: number;
  currency: "usd" | "gbp";
  bespokeOrderId: string;
  orderRef: string;
  customerEmail: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = await getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: params.currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      bespokeOrderId: params.bespokeOrderId,
      orderRef: params.orderRef,
      type: "bespoke",
    } as Record<string, string>,
    receipt_email: params.customerEmail,
  });

  const clientSecret = intent.client_secret;
  if (!clientSecret) throw new Error("Stripe did not return client_secret");

  return { clientSecret, paymentIntentId: intent.id };
}

export async function verifyWebhookEvent(rawBody: Buffer, signature: string | null): Promise<Stripe.Event> {
  const webhookSecret = await getStripeWebhookSecret();
  if (!webhookSecret) throw new Error("Stripe webhook secret is not configured");
  if (!signature) throw new Error("Missing stripe-signature");
  const stripe = await getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
