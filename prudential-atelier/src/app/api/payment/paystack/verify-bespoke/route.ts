import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { verifyTransaction } from "@/lib/payments/paystack";
import { fulfillPaidBespokeBalance } from "@/lib/bespoke-payment";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference");
  const bespokeRequestId = searchParams.get("bespokeRequestId");
  const appUrl = getPublicAppUrl();

  if (!reference || !bespokeRequestId) {
    return NextResponse.redirect(`${appUrl}/bespoke?error=payment-failed`);
  }

  try {
    const result = await verifyTransaction(reference);
    const bespoke = await prisma.bespokeRequest.findUnique({ where: { id: bespokeRequestId } });
    if (!bespoke) {
      return NextResponse.redirect(`${appUrl}/bespoke?error=payment-failed`);
    }

    if (result.status === "success") {
      await fulfillPaidBespokeBalance({
        bespokeRequestId: bespoke.id,
        paymentRef: reference,
        gateway: PaymentGateway.PAYSTACK,
      });
      return NextResponse.redirect(
        `${appUrl}/bespoke?payment=success&ref=${encodeURIComponent(bespoke.requestNumber)}`,
      );
    }

    if (bespoke.balancePaymentStatus === PaymentStatus.PAID) {
      return NextResponse.redirect(
        `${appUrl}/bespoke?payment=success&ref=${encodeURIComponent(bespoke.requestNumber)}`,
      );
    }

    await prisma.bespokeRequest.updateMany({
      where: { id: bespokeRequestId, balancePaymentStatus: PaymentStatus.PENDING },
      data: { balancePaymentStatus: PaymentStatus.FAILED },
    });
  } catch {
    return NextResponse.redirect(`${appUrl}/bespoke?error=payment-failed`);
  }

  return NextResponse.redirect(`${appUrl}/bespoke?error=payment-failed`);
}
