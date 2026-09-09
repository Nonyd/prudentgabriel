import { BespokeStage, InvoiceStatus, Prisma, QuoteStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import { generateBespokeOrderRef } from "@/lib/bespoke-stages";
import { generateInvoiceNumber, calculateInvoiceTotals, syncLineItemAmounts, getInvoiceDefaultValidityDays } from "@/lib/invoice";
import {
  buildDepositPaymentTerms,
  getBespokeDepositPercent,
} from "@/lib/payments/ledger";
import { clampDepositPercent } from "@/lib/invoice-deposit";
import { defaultExpiresAt } from "@/lib/document-validity";
import type { InvoiceLineItem } from "@/types/invoice";
import { logServerError } from "@/lib/logger";
import { getLockedFx, persistableFxFields, type LockedFx } from "@/lib/fx";
import {
  documentAmountToNGN,
  invoiceExchangeRateFromLocked,
  lockedDocumentTotal,
  lockedFxFromAtelier,
} from "@/lib/atelier-fx";
import { INTAKE_STAGES, intakeStageNotes } from "@/lib/atelier/intake-stages";
import { quotationCurrencySendable } from "@/lib/atelier-quote-currency";

type QuotationRecord = {
  id: string;
  quoteRef: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  lineItems: unknown;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes: string | null;
  status: QuoteStatus;
  consultationId?: string | null;
  currency: string;
  createdBy?: string | null;
  fxRateLocked?: number | null;
  fxGbpRateLocked?: number | null;
  fxRateSource?: string | null;
  fxRateFetchedAt?: Date | null;
  fxRateStale?: boolean | null;
  fxUsdAmountLocked?: number | null;
  fxGbpAmountLocked?: number | null;
  depositPercent?: number | null;
  expiresAt?: Date | null;
};

async function uniqueOrderRef(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const orderRef = generateBespokeOrderRef();
    const exists = await prisma.bespokeOrder.findUnique({ where: { orderRef } });
    if (!exists) return orderRef;
  }
  return generateBespokeOrderRef();
}

function mapLineItems(raw: unknown): InvoiceLineItem[] {
  if (!Array.isArray(raw)) return [];
  return syncLineItemAmounts(
    raw
      .map((row) => {
        const r = row as {
          description?: string;
          quantity?: number;
          unitPrice?: number;
          total?: number;
        };
        const qty = Number(r.quantity) || 1;
        const unit = Number(r.unitPrice) || 0;
        return {
          id: nanoid(),
          description: String(r.description ?? "Line item"),
          quantity: qty,
          unitPrice: unit,
          amount: Number(r.total) || qty * unit,
        };
      })
      .filter((i) => i.description.trim()),
  );
}

async function resolveIntakeActorId(createdBy?: string | null): Promise<string> {
  if (createdBy) {
    const user = await prisma.user.findUnique({ where: { id: createdBy }, select: { id: true } });
    if (user) return user.id;
  }
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("NO_ACTOR");
  return admin.id;
}

function fxFieldsForPersist(fx: LockedFx, currency: string, documentTotal: number) {
  const locked = lockedDocumentTotal(currency, documentTotal);
  return {
    ...persistableFxFields(fx),
    fxUsdAmountLocked: locked.fxUsdAmountLocked,
    fxGbpAmountLocked: locked.fxGbpAmountLocked,
  };
}

export async function convertQuotationToOrder(
  quote: QuotationRecord,
  createdBy?: string | null,
): Promise<{ orderId: string; orderRef: string; invoiceId: string; invoiceNumber: string }> {
  if (quote.status === QuoteStatus.SUPERSEDED) {
    throw new Error("SUPERSEDED");
  }

  const currencyGate = quotationCurrencySendable(quote.currency);
  if (!currencyGate.ok) {
    throw new Error("EUR_UNSUPPORTED");
  }

  const existingOrder = await prisma.bespokeOrder.findFirst({
    where: { quotationId: quote.id },
  });
  if (existingOrder) {
    throw new Error("ALREADY_CONVERTED");
  }

  const clientProfile = await prisma.clientProfile.findFirst({
    where: { user: { email: quote.clientEmail } },
  });

  const depositPercent = clampDepositPercent(
    quote.depositPercent != null ? quote.depositPercent : await getBespokeDepositPercent(),
  );
  const actorId = await resolveIntakeActorId(createdBy ?? quote.createdBy);

  const items = mapLineItems(quote.lineItems);
  const lineItemsPayload = items.length
    ? items
    : [
        {
          id: nanoid(),
          description: quote.quoteRef,
          quantity: 1,
          unitPrice: quote.total,
          amount: quote.total,
        },
      ];
  const totals = calculateInvoiceTotals({
    lineItems: lineItemsPayload,
    discountType: quote.discount > 0 ? "FIXED" : null,
    discountValue: quote.discount,
    vatEnabled: quote.tax > 0,
    vatPercent: quote.subtotal > 0 ? Math.round((quote.tax / quote.subtotal) * 10000) / 100 : 0,
    depositPercent,
    depositPaid: 0,
  });

  const currency = quote.currency || "NGN";
  const paymentTerms = buildDepositPaymentTerms({
    total: totals.total || quote.total,
    depositPercent,
    currency,
  });

  const orderRef = await uniqueOrderRef();

  const consultation = quote.consultationId
    ? await prisma.consultationBooking.findUnique({
        where: { id: quote.consultationId },
      })
    : null;

  let fx = lockedFxFromAtelier(quote);
  if (!quote.fxRateLocked && (currency === "USD" || currency === "GBP")) {
    fx = await getLockedFx();
  }
  const fxPersist = fxFieldsForPersist(fx, currency, quote.total);
  const exchangeRate = invoiceExchangeRateFromLocked(currency, fx);
  const totalNGN = documentAmountToNGN(quote.total, currency, fx);

  const validityDays = await getInvoiceDefaultValidityDays();
  const expiresAt = quote.expiresAt ?? defaultExpiresAt(new Date(), validityDays);

  const result = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateInvoiceNumber(tx);
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        quotationId: quote.id,
        consultationId: quote.consultationId ?? null,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        clientPhone: quote.clientPhone,
        currency,
        exchangeRate,
        status: InvoiceStatus.DRAFT,
        lineItems: lineItemsPayload as unknown as Prisma.InputJsonValue,
        subtotal: totals.subtotal || quote.subtotal,
        discountType: quote.discount > 0 ? "FIXED" : null,
        discountValue: quote.discount,
        discountAmount: totals.discountAmount,
        vatEnabled: quote.tax > 0,
        vatPercent: quote.subtotal > 0 ? Math.round((quote.tax / quote.subtotal) * 10000) / 100 : 0,
        vatAmount: totals.vatAmount || quote.tax,
        total: totals.total || quote.total,
        depositRequired: totals.depositRequired,
        depositPaid: 0,
        balanceDue: totals.balanceDue,
        depositPercent,
        paymentTerms,
        expiresAt,
        notes: quote.notes,
        paymentHistory: [],
        createdBy: createdBy ?? null,
      },
    });

    const order = await tx.bespokeOrder.create({
      data: {
        orderRef,
        quotationId: quote.id,
        consultationId: quote.consultationId ?? null,
        clientProfileId: clientProfile?.id ?? null,
        clientName: consultation?.clientName ?? quote.clientName,
        clientEmail: consultation?.clientEmail ?? quote.clientEmail,
        clientPhone: consultation?.clientPhone ?? quote.clientPhone,
        outfitDescription: consultation?.sessionNotes ?? quote.notes,
        occasionType: consultation?.occasion ?? null,
        sessionNotes: consultation?.sessionNotes ?? null,
        moodboardImages: consultation?.moodboardImages ?? [],
        occasionDetails: consultation?.occasion ?? null,
        outfitBrief: consultation?.sessionNotes ?? null,
        currency,
        ...fxPersist,
        totalAmount: totalNGN,
        balance: totalNGN,
        notes: quote.notes,
        currentStage: BespokeStage.SKETCHING_CONCEPT,
      },
    });

    const notes = intakeStageNotes({
      bookingNumber: consultation?.bookingNumber ?? null,
      quoteRef: quote.quoteRef,
      invoiceNumber: invoice.invoiceNumber,
      consultationPaid: Boolean(consultation?.paidAt || consultation?.paymentRef),
      consultationPaymentRef: consultation?.paymentRef ?? null,
    });

    for (const stage of INTAKE_STAGES) {
      await tx.stageUpdate.create({
        data: {
          orderId: order.id,
          stage,
          notes: notes[stage],
          images: [],
          videos: [],
          completedBy: actorId,
          completedByName: "System",
        },
      });
      await tx.orderStageCompletion.create({
        data: {
          orderId: order.id,
          stage,
          completedById: actorId,
          notes: notes[stage],
        },
      });
    }

    await tx.quotation.update({
      where: { id: quote.id },
      data: {
        status: QuoteStatus.CONVERTED,
        ...(quote.fxRateLocked ? {} : fxPersist),
      },
    });

    return { order, invoice };
  }, INTERACTIVE_TX);

  return {
    orderId: result.order.id,
    orderRef: result.order.orderRef,
    invoiceId: result.invoice.id,
    invoiceNumber: result.invoice.invoiceNumber,
  };
}

export async function maybeAutoConvertApprovedQuote(quoteId: string): Promise<void> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: "auto_convert_approved_quotes" },
  });
  if (setting?.value !== "true") return;

  const quote = await prisma.quotation.findUnique({ where: { id: quoteId } });
  if (!quote || quote.status !== QuoteStatus.APPROVED) return;

  try {
    await convertQuotationToOrder(quote);
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_CONVERTED") return;
    await logServerError({ errorType: "QUOTE_AUTO_CONVERT", error: e });
  }
}
