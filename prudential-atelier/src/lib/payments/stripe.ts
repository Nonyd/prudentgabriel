import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getStripe(): Stripe {
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key);
}

export async function createPaymentIntent(params: {
  amountCents: number;
  currency: "usd" | "gbp";
  orderId: string;
  orderNumber: string;
  customerEmail: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe();
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
  const stripe = getStripe();
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

export function verifyWebhookEvent(rawBody: Buffer, signature: string | null): Stripe.Event {
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  if (!signature) throw new Error("Missing stripe-signature");
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
