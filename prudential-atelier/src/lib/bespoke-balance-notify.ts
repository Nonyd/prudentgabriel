import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { sendAdminNotificationEmail, sendPaymentConfirmedEmail } from "@/lib/email";
import { notifyPaymentConfirmed } from "@/lib/customer-notifications";
import { formatNGN } from "@/lib/utils";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * After `fulfillPaidBespokeBalance` claims an online balance payment. Only the
 * caller whose claim won (webhook or redirect) should call this; the outbox key
 * still guards against a second send.
 */
export async function notifyBespokeBalancePaid(params: {
  bespokeRequestId: string;
  paymentRef: string;
}): Promise<void> {
  const request = await prisma.bespokeRequest.findUnique({
    where: { id: params.bespokeRequestId },
    select: { id: true, requestNumber: true, name: true, email: true, userId: true, agreedPrice: true },
  });
  if (!request) return;

  const appUrl = getPublicAppUrl();
  const amountNGN = request.agreedPrice ?? 0;

  await sendPaymentConfirmedEmail({
    to: request.email,
    ref: request.requestNumber,
    amountNGN,
    kind: "bespoke",
    trackUrl: `${appUrl}/account`,
    paymentRef: params.paymentRef,
  });
  notifyPaymentConfirmed({
    userId: request.userId,
    clientEmail: request.email,
    ref: request.requestNumber,
    link: `${appUrl}/account`,
    entityId: request.id,
  });
  await sendAdminNotificationEmail(
    `Bespoke balance paid online — ${request.requestNumber}`,
    `<p>${esc(request.name)} paid the outstanding balance on <strong>${request.requestNumber}</strong> online.</p>
<p>Reference: ${esc(params.paymentRef)}<br/>Agreed price: ${formatNGN(amountNGN)}</p>
<p><a href="${appUrl}/admin/bespoke/intake/${request.id}">Open the request</a></p>`,
    `bespoke-balance-paid-admin:${params.paymentRef}`,
    "payments",
  );
}
