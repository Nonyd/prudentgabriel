import { PaymentGateway } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import type { ShopCurrency } from "@/lib/currency";
import { generatePaymentReference, type PaymentGatewayType } from "@/lib/payments/index";
import { initializeTransaction as initPaystack } from "@/lib/payments/paystack";
import { initializeTransaction as initFlutterwave } from "@/lib/payments/flutterwave";
import { initializeTransaction as initMonnify } from "@/lib/payments/monnify";
import { createBespokePaymentIntent } from "@/lib/payments/stripe";
import { getStripePublicKey, getSupportedGateways } from "@/lib/payments/config";
import { encodeBespokePaymentRef } from "@/lib/bespoke-order-access";
import { atelierChargeAmountForeign, asShopPayCurrency, lockedFxFromAtelier } from "@/lib/atelier-fx";
import { roundToKobo } from "@/lib/money";

export const MIN_PARTIAL_NGN = 10_000;

export type BespokePayOrder = {
  id: string;
  orderRef: string;
  balance: number;
  totalAmount: number;
  clientPhone: string | null;
  currency?: string | null;
  fxRateLocked?: number | null;
  fxGbpRateLocked?: number | null;
  fxRateSource?: string | null;
  fxRateFetchedAt?: Date | null;
  fxRateStale?: boolean | null;
  fxUsdAmountLocked?: number | null;
  fxGbpAmountLocked?: number | null;
};

export type BespokeGatewayInit = {
  paymentUrl?: string;
  clientSecret?: string;
  publishableKey?: string;
  reference: string;
  amountNGN: number;
};

export async function initializeBespokeGatewayPayment(params: {
  order: BespokePayOrder;
  amountNGN: number;
  currency: ShopCurrency;
  gateway: Exclude<PaymentGatewayType, "BANK_TRANSFER">;
  email: string;
  name: string;
}): Promise<{ ok: true; data: BespokeGatewayInit } | { ok: false; status: number; error: string }> {
  const { order, email, name } = params;
  const currency = asShopPayCurrency(params.currency);
  const offered = await getSupportedGateways(currency, "ATELIER");
  if (!offered.includes(params.gateway)) {
    return { ok: false, status: 400, error: "That payment method is not available for this currency" };
  }

  const payAmountNGN = Math.min(roundToKobo(params.amountNGN), roundToKobo(order.balance));
  if (payAmountNGN <= 0) {
    return { ok: false, status: 400, error: "Nothing to pay" };
  }
  if (payAmountNGN < MIN_PARTIAL_NGN && payAmountNGN < order.balance) {
    return {
      ok: false,
      status: 400,
      error: `Minimum partial payment is ₦${MIN_PARTIAL_NGN.toLocaleString("en-NG")}`,
    };
  }

  const reference = generatePaymentReference("BESPOKE");
  const encodedRef = encodeBespokePaymentRef(reference, payAmountNGN);
  const appUrl = getPublicAppUrl();
  const fx = lockedFxFromAtelier(order);
  const chargeForeign = atelierChargeAmountForeign({
    amountNGN: payAmountNGN,
    totalNGN: order.totalAmount,
    currency,
    fx,
    fxUsdAmountLocked: order.fxUsdAmountLocked,
    fxGbpAmountLocked: order.fxGbpAmountLocked,
  });

  await prisma.bespokeOrder.update({
    where: { id: order.id },
    data: {
      paymentGateway: params.gateway as PaymentGateway,
      paymentRef: encodedRef,
    },
  });

  const verifyBase = `${appUrl}/api/bespoke/${order.id}/verify-payment`;

  if (params.gateway === "PAYSTACK") {
    const init = await initPaystack({
      email,
      amountKobo: Math.round(payAmountNGN * 100),
      reference,
      callbackUrl: `${verifyBase}?gateway=PAYSTACK`,
      metadata: { bespokeOrderId: order.id, amountNGN: String(payAmountNGN) },
    });
    return {
      ok: true,
      data: { paymentUrl: init.authorizationUrl, reference: init.reference, amountNGN: payAmountNGN },
    };
  }

  if (params.gateway === "FLUTTERWAVE") {
    const fwAmount = currency === "NGN" ? payAmountNGN : chargeForeign;
    const init = await initFlutterwave({
      txRef: reference,
      amount: fwAmount,
      currency,
      email,
      name,
      phone: order.clientPhone ?? undefined,
      redirectUrl: `${verifyBase}?gateway=FLUTTERWAVE`,
      meta: { orderId: order.id },
    });
    return { ok: true, data: { paymentUrl: init.paymentLink, reference, amountNGN: payAmountNGN } };
  }

  if (params.gateway === "MONNIFY") {
    const init = await initMonnify({
      amountNGN: payAmountNGN,
      reference,
      customerEmail: email,
      customerName: name,
      description: `Bespoke balance · ${order.orderRef}`,
      redirectUrl: `${verifyBase}?gateway=MONNIFY`,
    });
    return { ok: true, data: { paymentUrl: init.checkoutUrl, reference, amountNGN: payAmountNGN } };
  }

  if (params.gateway === "STRIPE") {
    if (currency === "NGN") {
      return { ok: false, status: 400, error: "Use USD or GBP for Stripe" };
    }
    const amountCents = Math.max(50, Math.round(chargeForeign * 100));
    const { clientSecret, paymentIntentId } = await createBespokePaymentIntent({
      amountCents,
      currency: currency.toLowerCase() as "usd" | "gbp",
      bespokeOrderId: order.id,
      orderRef: order.orderRef,
      customerEmail: email,
    });
    await prisma.bespokeOrder.update({
      where: { id: order.id },
      data: { paymentRef: encodeBespokePaymentRef(paymentIntentId, payAmountNGN) },
    });
    const publishableKey = (await getStripePublicKey()) ?? "";
    return {
      ok: true,
      data: { clientSecret, publishableKey, reference: paymentIntentId, amountNGN: payAmountNGN },
    };
  }

  return { ok: false, status: 400, error: "Unsupported gateway" };
}
