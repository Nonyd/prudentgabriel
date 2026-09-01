import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

/** Uncaught Paystack/Stripe throws become empty 500s; the checkout toast then says "Unexpected end of JSON input". */
export async function catchPaymentInit(
  orderId: string | undefined,
  work: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await work();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Payment could not be started";
    await logError({
      severity: "WARNING",
      errorType: "PAYMENT_INIT",
      message,
      stack: e instanceof Error ? e.stack : undefined,
      orderId,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
