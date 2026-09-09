import { prisma } from "@/lib/prisma";
import { roundToKobo } from "@/lib/money";

export function encodeBespokePaymentRef(reference: string, amountNGN: number): string {
  return `${reference}|${roundToKobo(amountNGN).toFixed(2)}`;
}

export function parseBespokePaymentRef(paymentRef: string | null | undefined): {
  reference: string;
  amountNGN?: number;
} {
  if (!paymentRef) return { reference: "" };
  const idx = paymentRef.lastIndexOf("|");
  if (idx === -1) return { reference: paymentRef };
  const reference = paymentRef.slice(0, idx);
  const amountNGN = Number(paymentRef.slice(idx + 1));
  return {
    reference,
    amountNGN: Number.isFinite(amountNGN) && amountNGN > 0 ? amountNGN : undefined,
  };
}

export async function getBespokeOrderForUser(orderId: string, userId: string) {
  const profile = await prisma.clientProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return null;

  return prisma.bespokeOrder.findFirst({
    where: { id: orderId, clientProfileId: profile.id },
  });
}
