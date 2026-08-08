import {
  AlterationPricing,
  AlterationReason,
  AlterationStatus,
  OrderStatus,
  Prisma,
  QuoteStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import {
  getAlterationWarrantyDays,
  suggestAlterationPricing,
} from "@/lib/alterations/policy";
import { allocateQuotationBaseRef, formatQuotationRef } from "@/lib/document-numbers";
import { maybeArchiveBespokeOrder } from "@/lib/bespoke-archive";

export async function createAlterationRequest(params: {
  orderId: string;
  clientUserId: string;
  description: string;
  reason: AlterationReason;
  media?: string[];
}) {
  const order = await prisma.bespokeOrder.findUnique({ where: { id: params.orderId } });
  if (!order) throw new Error("NOT_FOUND");
  if (order.status === OrderStatus.ARCHIVED) throw new Error("ARCHIVED");
  if (order.status !== OrderStatus.DELIVERED && !order.deliveredAt) {
    throw new Error("NOT_DELIVERED");
  }

  const profile = await prisma.clientProfile.findUnique({
    where: { userId: params.clientUserId },
  });
  if (!profile) throw new Error("NO_PROFILE");

  const owns =
    order.clientProfileId === profile.id ||
    (await prisma.user.findUnique({ where: { id: params.clientUserId } }))?.email?.toLowerCase() ===
      order.clientEmail.toLowerCase();
  if (!owns) throw new Error("FORBIDDEN");

  return prisma.alterationRequest.create({
    data: {
      orderId: order.id,
      clientId: profile.id,
      description: params.description.trim(),
      reason: params.reason,
      media: (params.media ?? []) as unknown as Prisma.InputJsonValue,
      status: AlterationStatus.REQUESTED,
    },
  });
}

export async function triageAlterationRequest(params: {
  alterationId: string;
  action: "ACCEPT" | "DECLINE";
  pricingDecision?: AlterationPricing;
  pricingOverrideReason?: string | null;
  complimentaryEstimatedValue?: number | null;
  declineReason?: string | null;
  quoteLineItems?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  actorId: string;
}) {
  const row = await prisma.alterationRequest.findUnique({
    where: { id: params.alterationId },
    include: { order: true },
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.status !== AlterationStatus.REQUESTED) throw new Error("NOT_REQUESTED");

  const warrantyDays = await getAlterationWarrantyDays();
  const pricingDefault = suggestAlterationPricing({
    reason: row.reason,
    deliveredAt: row.order.deliveredAt,
    warrantyDays,
  });

  if (params.action === "DECLINE") {
    const updated = await prisma.alterationRequest.update({
      where: { id: row.id },
      data: {
        status: AlterationStatus.DECLINED,
        declineReason: params.declineReason?.trim() || "Declined",
        pricingDefault,
        resolvedAt: new Date(),
      },
    });
    await maybeArchiveBespokeOrder(row.orderId);
    return { alteration: updated, quotationId: null as string | null };
  }

  const decision = params.pricingDecision ?? pricingDefault;
  const overridden = decision !== pricingDefault;
  if (overridden && !params.pricingOverrideReason?.trim()) {
    throw new Error("OVERRIDE_REASON_REQUIRED");
  }

  if (decision === AlterationPricing.FREE) {
    const est = params.complimentaryEstimatedValue;
    if (est == null || !Number.isFinite(est) || est < 0) {
      throw new Error("ESTIMATED_VALUE_REQUIRED");
    }
    const updated = await prisma.alterationRequest.update({
      where: { id: row.id },
      data: {
        status: AlterationStatus.ACCEPTED,
        pricingDefault,
        pricingDecision: AlterationPricing.FREE,
        pricingOverrideReason: overridden ? params.pricingOverrideReason!.trim() : null,
        complimentaryEstimatedValue: est,
      },
    });
    return { alteration: updated, quotationId: null as string | null };
  }

  // CHARGEABLE — create draft quotation linked to this alteration
  const lines = params.quoteLineItems?.length
    ? params.quoteLineItems
    : [
        {
          description: `Post-delivery alteration — ${row.reason}`,
          quantity: 1,
          unitPrice: 0,
          total: 0,
        },
      ];
  const subtotal = lines.reduce((s, l) => s + l.total, 0);

  const result = await prisma.$transaction(async (tx) => {
    const baseQuoteRef = await allocateQuotationBaseRef(tx);
    const quoteRef = formatQuotationRef(baseQuoteRef, 1);
    const quote = await tx.quotation.create({
      data: {
        quoteRef,
        baseQuoteRef,
        version: 1,
        clientName: row.order.clientName,
        clientEmail: row.order.clientEmail,
        clientPhone: row.order.clientPhone,
        lineItems: lines as unknown as Prisma.InputJsonValue,
        subtotal,
        tax: 0,
        discount: 0,
        total: subtotal,
        notes: `Alteration for ${row.order.orderRef}: ${row.description.slice(0, 500)}`,
        status: QuoteStatus.DRAFT,
        createdBy: params.actorId,
      },
    });
    const updated = await tx.alterationRequest.update({
      where: { id: row.id },
      data: {
        status: AlterationStatus.ACCEPTED,
        pricingDefault,
        pricingDecision: AlterationPricing.CHARGEABLE,
        pricingOverrideReason: overridden ? params.pricingOverrideReason!.trim() : null,
        quotationId: quote.id,
      },
    });
    return { alteration: updated, quotationId: quote.id };
  }, INTERACTIVE_TX);

  return result;
}

export async function updateAlterationStatus(params: {
  alterationId: string;
  status: AlterationStatus;
}) {
  const allowed: AlterationStatus[] = [
    AlterationStatus.IN_PROGRESS,
    AlterationStatus.COMPLETED,
    AlterationStatus.ACCEPTED,
  ];
  if (!allowed.includes(params.status)) throw new Error("BAD_STATUS");

  const row = await prisma.alterationRequest.update({
    where: { id: params.alterationId },
    data: {
      status: params.status,
      resolvedAt: params.status === AlterationStatus.COMPLETED ? new Date() : undefined,
    },
  });
  if (params.status === AlterationStatus.COMPLETED) {
    await maybeArchiveBespokeOrder(row.orderId);
  }
  return row;
}
