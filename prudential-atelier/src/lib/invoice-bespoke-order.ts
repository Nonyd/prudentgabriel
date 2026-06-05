import { prisma } from "@/lib/prisma";

export type BespokeOrderLink = { id: string; orderRef: string };

export async function mapBespokeOrdersByRequestId(
  requestIds: string[],
): Promise<Map<string, BespokeOrderLink>> {
  const ids = Array.from(new Set(requestIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const orders = await prisma.bespokeOrder.findMany({
    where: { bespokeRequestId: { in: ids } },
    select: { id: true, orderRef: true, bespokeRequestId: true },
    orderBy: { createdAt: "desc" },
  });

  const map = new Map<string, BespokeOrderLink>();
  for (const order of orders) {
    if (order.bespokeRequestId && !map.has(order.bespokeRequestId)) {
      map.set(order.bespokeRequestId, { id: order.id, orderRef: order.orderRef });
    }
  }
  return map;
}

export async function mapBespokeOrdersByClientEmail(
  emails: string[],
): Promise<Map<string, BespokeOrderLink>> {
  const normalized = Array.from(
    new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
  );
  if (normalized.length === 0) return new Map();

  const orders = await prisma.bespokeOrder.findMany({
    where: { clientEmail: { in: normalized } },
    select: { id: true, orderRef: true, clientEmail: true },
    orderBy: { createdAt: "desc" },
  });

  const map = new Map<string, BespokeOrderLink>();
  for (const order of orders) {
    const key = order.clientEmail.trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, { id: order.id, orderRef: order.orderRef });
    }
  }
  return map;
}

export async function getBespokeOrderForRequest(
  bespokeRequestId: string | null | undefined,
): Promise<BespokeOrderLink | null> {
  if (!bespokeRequestId) return null;
  return prisma.bespokeOrder.findFirst({
    where: { bespokeRequestId },
    select: { id: true, orderRef: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBespokeOrderForInvoice(params: {
  bespokeRequestId?: string | null;
  clientEmail: string;
}): Promise<BespokeOrderLink | null> {
  const byRequest = await getBespokeOrderForRequest(params.bespokeRequestId);
  if (byRequest) return byRequest;

  return prisma.bespokeOrder.findFirst({
    where: { clientEmail: params.clientEmail.trim().toLowerCase() },
    select: { id: true, orderRef: true },
    orderBy: { createdAt: "desc" },
  });
}
