import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Marks a bespoke request as fully paid after the client completes the Paystack
 * checkout opened from the admin-generated balance link.
 */
export async function fulfillPaidBespokeBalance(params: {
  bespokeRequestId: string;
  paymentRef: string;
  gateway: PaymentGateway;
}): Promise<boolean> {
  const note = `\n\nOnline balance paid (${params.gateway}) ref: ${params.paymentRef}`;

  const ok = await prisma.$transaction(async (tx) => {
    const row = await tx.bespokeRequest.findFirst({
      where: { id: params.bespokeRequestId, balancePaymentStatus: PaymentStatus.PENDING },
      select: { id: true, agreedPrice: true, adminNotes: true },
    });
    if (!row?.agreedPrice) return false;

    await tx.bespokeRequest.update({
      where: { id: row.id },
      data: {
        balancePaymentStatus: PaymentStatus.PAID,
        depositPaid: row.agreedPrice,
        paymentMethod: "Paid Online",
        adminNotes: [row.adminNotes?.trim(), note.trim()].filter(Boolean).join("\n\n"),
      },
    });
    return true;
  });

  return ok;
}
