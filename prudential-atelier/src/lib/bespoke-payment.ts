import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPspChargeBinds, expectedAmountInPspUnits } from "@/lib/payment-bind";

/** Charge details as reported by the PSP's server-side verify call — never client input. */
export type BespokeBalanceCharge = {
  reference: string;
  /** Paystack: kobo. */
  amount: number;
  currency: string;
};

/** Outstanding balance the online link was issued for (`agreedPrice − depositPaid`, NGN). */
export function bespokeBalanceMajorNGN(row: {
  agreedPrice: number | null;
  depositPaid: number | null;
}): number {
  return Math.max(0, (row.agreedPrice ?? 0) - (row.depositPaid ?? 0));
}

/**
 * Marks a bespoke request as fully paid after the client completes the Paystack
 * checkout opened from the admin-generated balance link.
 *
 * The charge must carry the reference stored when the link was issued
 * (`balancePaystackRef`) — metadata alone is not enough, since anyone holding
 * the public key can open a checkout with arbitrary metadata and amount — and
 * must cover the outstanding NGN balance. Throws `PaymentBindError` otherwise.
 */
export async function fulfillPaidBespokeBalance(params: {
  bespokeRequestId: string;
  gateway: PaymentGateway;
  charge: BespokeBalanceCharge;
  /** Test seam; defaults to the shared Prisma client. */
  db?: Pick<typeof prisma, "$transaction">;
}): Promise<boolean> {
  const { charge } = params;
  const note = `\n\nOnline balance paid (${params.gateway}) ref: ${charge.reference}`;

  const db = params.db ?? prisma;
  return db.$transaction(async (tx) => {
    const row = await tx.bespokeRequest.findFirst({
      where: { id: params.bespokeRequestId, balancePaymentStatus: PaymentStatus.PENDING },
      select: {
        id: true,
        agreedPrice: true,
        depositPaid: true,
        adminNotes: true,
        balancePaystackRef: true,
      },
    });
    if (!row?.agreedPrice) return false;

    const balance = bespokeBalanceMajorNGN(row);
    if (balance <= 0) return false;

    assertPspChargeBinds(
      {
        id: row.id,
        storedReference: row.balancePaystackRef,
        expectedAmount: expectedAmountInPspUnits(params.gateway, balance),
        expectedCurrency: "NGN",
      },
      {
        gateway: params.gateway,
        reference: charge.reference,
        amount: charge.amount,
        currency: charge.currency,
        // Deliberately omitted: bind on the stored reference only.
        metadataEntityId: null,
      },
    );

    // Claim atomically so a webhook and the redirect callback can't both fulfil.
    const claimed = await tx.bespokeRequest.updateMany({
      where: { id: row.id, balancePaymentStatus: PaymentStatus.PENDING },
      data: {
        balancePaymentStatus: PaymentStatus.PAID,
        depositPaid: row.agreedPrice,
        paymentMethod: "Paid Online",
        adminNotes: [row.adminNotes?.trim(), note.trim()].filter(Boolean).join("\n\n"),
      },
    });
    return claimed.count === 1;
  });
}
