import { QuoteStatus, type Quotation, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateQuotationBaseRef, formatQuotationRef } from "@/lib/document-numbers";
import { logActivity } from "@/lib/logger";

export async function findLatestQuotationVersion(baseQuoteRef: string) {
  return prisma.quotation.findFirst({
    where: {
      baseQuoteRef,
      status: { not: QuoteStatus.SUPERSEDED },
    },
    orderBy: { version: "desc" },
  });
}

export function isQuotationEditable(status: QuoteStatus): boolean {
  return status === QuoteStatus.DRAFT;
}

export function canApproveQuotation(status: QuoteStatus): boolean {
  return status === QuoteStatus.SENT || status === QuoteStatus.DRAFT;
}

/**
 * Clone a sent (or approved, unconverted) quotation into a new version.
 * Marks the previous row SUPERSEDED. Never mutates the previous terms.
 */
export async function reviseQuotation(params: {
  quotationId: string;
  actor: { id: string; email?: string | null; role?: string | null };
}): Promise<Quotation> {
  const existing = await prisma.quotation.findUnique({
    where: { id: params.quotationId },
    include: {
      invoices: { select: { id: true, invoiceNumber: true }, take: 1 },
      bespokeOrders: { select: { id: true }, take: 1 },
    },
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.status === QuoteStatus.SUPERSEDED) {
    throw new Error("SUPERSEDED");
  }
  if (existing.status === QuoteStatus.CONVERTED || existing.invoices.length > 0 || existing.bespokeOrders.length > 0) {
    throw new Error("CONVERTED");
  }
  if (existing.status === QuoteStatus.DRAFT && !existing.sentAt) {
    throw new Error("DRAFT_EDIT");
  }

  const nextVersion = existing.version + 1;
  const quoteRef = formatQuotationRef(existing.baseQuoteRef, nextVersion);

  const created = await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id: existing.id },
      data: { status: QuoteStatus.SUPERSEDED },
    });

    return tx.quotation.create({
      data: {
        quoteRef,
        baseQuoteRef: existing.baseQuoteRef,
        version: nextVersion,
        parentQuotationId: existing.id,
        clientName: existing.clientName,
        clientEmail: existing.clientEmail,
        clientPhone: existing.clientPhone,
        lineItems: existing.lineItems as Prisma.InputJsonValue,
        subtotal: existing.subtotal,
        tax: existing.tax,
        discount: existing.discount,
        total: existing.total,
        notes: existing.notes,
        status: QuoteStatus.DRAFT,
        expiresAt: existing.expiresAt,
        consultationId: existing.consultationId,
        createdBy: params.actor.id,
        revisedBy: params.actor.id,
      },
    });
  });

  await logActivity({
    userId: params.actor.id,
    userEmail: params.actor.email ?? undefined,
    userRole: params.actor.role ?? undefined,
    action: "UPDATE",
    module: "quotations",
    description: `Revised quotation ${existing.quoteRef} → ${created.quoteRef} (v${nextVersion})`,
    recordId: created.id,
    recordType: "Quotation",
  });

  return created;
}

export { allocateQuotationBaseRef, formatQuotationRef };
