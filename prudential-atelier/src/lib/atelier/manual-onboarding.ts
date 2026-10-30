import { randomBytes } from "node:crypto";
import { BespokeStage, PaymentMethod, PaymentPurpose, PaymentStatus, QuoteStatus, Role, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { convertQuotationToOrder } from "@/lib/quotation-convert";
import { allocateQuotationBaseRef, formatQuotationRef } from "@/lib/document-numbers";
import { generateCapabilityToken } from "@/lib/capability-token";
import { quotationApprovalExpiresAt } from "@/lib/capability-token-lookup";
import { defaultExpiresAt } from "@/lib/document-validity";
import { getInvoiceDefaultValidityDays, parseInvoicePaymentHistory } from "@/lib/invoice";
import { appendPayment, getBespokeDepositPercent, getInvoicePaymentSummary, toNumber } from "@/lib/payments/ledger";
import { isUndeliverableAddress } from "@/lib/email-outbox";
import { logActivity } from "@/lib/logger";
import { STAGE_LABELS } from "@/lib/bespoke-stages";
import { RECORDABLE_TARGETS, recordProgressOutsideApp, type RecordProgressActor } from "@/lib/atelier/record-progress";

/**
 * Onboard a client by hand: the admin's "New client" form. The same steps as
 * scripts/import-atelier-orders.ts, through the app's own code paths:
 *   - her account (CUSTOMER, no password). With no email she gets a placeholder on the
 *     `.invalid` domain: she cannot sign in and the outbox never mails it;
 *   - her place as a default address;
 *   - an approved quotation converted by convertQuotationToOrder, so the order code,
 *     invoice number and quotation number come from the website's own sequences;
 *   - the payments she has made, through the ledger (which unlocks production);
 *   - the stages done before today, by recordProgressOutsideApp.
 * Nothing is emailed and no payment link is made.
 */

export const PLACEHOLDER_EMAIL_DOMAIN = "no-email.prudentgabriel.invalid";

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

export function placeholderEmail(name: string): string {
  const slug =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "client";
  return `client-${slug}-${randomBytes(3).toString("hex")}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date");
const optionalDay = z.union([isoDay, z.literal(""), z.null()]).optional().transform((v) => v || null);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

export const onboardSchema = z
  .object({
    client: z.object({
      name: z.string().trim().min(2, "Her name is needed").max(120),
      email: z
        .union([z.string().trim().toLowerCase().email("That email does not look right"), z.literal("")])
        .optional()
        .transform((v) => v || null),
      phone: optionalText(40),
      street: optionalText(200),
      city: optionalText(80),
      state: optionalText(80),
      country: z.string().trim().min(2, "Country is needed").max(80),
      occasions: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
      teamNote: optionalText(2000),
    }),
    commission: z.object({
      title: z.string().trim().min(2, "Name the piece, e.g. “Birthday dress”").max(120),
      occasion: z.string().trim().min(2, "The occasion is needed").max(80),
      garmentTypeId: optionalText(40),
      description: z.string().trim().min(2, "Describe the piece").max(4000),
      brief: optionalText(8000),
      orderDate: isoDay,
      eventDate: optionalDay,
      eventLocation: optionalText(200),
      deliveryDate: optionalDay,
    }),
    money: z.object({
      price: z.number().positive("The agreed price must be more than 0").max(1_000_000_000),
      payments: z
        .array(
          z.object({
            amount: z.number().positive("Each payment must be more than 0"),
            date: isoDay,
            method: z.enum(["BANK_TRANSFER", "MANUAL"]),
            note: optionalText(200),
          }),
        )
        .max(30),
    }),
    progress: z.object({
      currentStage: z.nativeEnum(BespokeStage).refine((s) => RECORDABLE_TARGETS.includes(s), "Choose a stage from Sketching to Delivery"),
      stages: z
        .partialRecord(z.nativeEnum(BespokeStage), z.object({ note: optionalText(1000), doneOn: optionalDay }))
        .optional(),
    }),
  })
  .superRefine((v, ctx) => {
    const paid = v.money.payments.reduce((s, p) => s + p.amount, 0);
    if (paid > v.money.price + 0.01) {
      ctx.addIssue({ code: "custom", path: ["money", "payments"], message: "She has paid more than the agreed price." });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (v.commission.orderDate > today) {
      ctx.addIssue({ code: "custom", path: ["commission", "orderDate"], message: "The order date cannot be in the future." });
    }
    for (const [i, p] of v.money.payments.entries()) {
      if (p.date > today) ctx.addIssue({ code: "custom", path: ["money", "payments", i, "date"], message: "A payment cannot be in the future." });
    }
  });

export type OnboardInput = z.infer<typeof onboardSchema>;

export type OnboardResult =
  | { ok: true; clientId: string; userId: string; email: string; placeholder: boolean; orderId: string; orderRef: string; invoiceNumber: string; quoteRef: string; productionUnlocked: boolean }
  | { ok: false; status: number; error: string; clientId?: string; partial?: { clientId: string; orderId?: string } };

const day = (v: string) => new Date(`${v}T12:00:00.000Z`);

export async function onboardClientManually(input: OnboardInput, actor: RecordProgressActor): Promise<OnboardResult> {
  const { client: c, commission: k, money, progress } = input;

  if (c.email) {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: c.email, mode: "insensitive" } },
      select: { role: true, clientProfile: { select: { id: true } } },
    });
    if (existing) {
      return existing.clientProfile && existing.role === Role.CUSTOMER
        ? { ok: false, status: 409, error: "A client with this email is already on file. Open her file to add a commission.", clientId: existing.clientProfile.id }
        : { ok: false, status: 409, error: "This email belongs to an account that is not a client." };
    }
  }
  if (k.garmentTypeId) {
    const g = await prisma.garmentType.findUnique({ where: { id: k.garmentTypeId }, select: { archivedAt: true } });
    if (!g || g.archivedAt) return { ok: false, status: 400, error: "That garment type is no longer offered." };
  }

  const placeholder = !c.email;
  const email = c.email ?? placeholderEmail(c.name);
  if (placeholder && !isUndeliverableAddress(email)) throw new Error("placeholder would be mailed");

  const orderDate = day(k.orderDate);
  const deliveryDate = k.deliveryDate ? new Date(`${k.deliveryDate}T00:00:00.000Z`) : null;
  const place = [c.city, c.state, c.country].filter(Boolean).join(", ");
  const brief = [k.description, k.brief].filter(Boolean).join("\n\n");
  const occasions = Array.from(new Set([k.occasion, ...(c.occasions ?? [])]));
  const validityDays = await getInvoiceDefaultValidityDays();
  const depositPercent = await getBespokeDepositPercent();

  // 1. Her account, profile, address and an approved quotation: all or nothing.
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name: c.name, phone: c.phone, role: Role.CUSTOMER },
      select: { id: true },
    });
    const profile = await tx.clientProfile.create({ data: { userId: user.id, occasions }, select: { id: true } });
    if (c.city || c.street || c.state) {
      const [firstName, ...rest] = c.name.split(/\s+/);
      await tx.address.create({
        data: {
          userId: user.id,
          label: c.street ? "Home" : "Place only",
          firstName: firstName ?? c.name,
          lastName: rest.join(" "),
          phone: c.phone ?? "",
          street: c.street ?? "",
          city: c.city ?? "",
          state: c.state ?? "",
          country: c.country,
          isDefault: true,
        },
      });
    }
    const baseQuoteRef = await allocateQuotationBaseRef(tx);
    const approval = generateCapabilityToken();
    const expiresAt = defaultExpiresAt(orderDate, validityDays);
    const quote = await tx.quotation.create({
      data: {
        quoteRef: formatQuotationRef(baseQuoteRef, 1),
        baseQuoteRef,
        version: 1,
        clientName: c.name,
        clientEmail: email,
        clientPhone: c.phone,
        lineItems: [{ description: k.title, quantity: 1, unitPrice: money.price, total: money.price }] as unknown as Prisma.InputJsonValue,
        subtotal: money.price,
        total: money.price,
        currency: "NGN",
        notes: brief,
        status: QuoteStatus.APPROVED,
        approvedAt: orderDate,
        expiresAt,
        depositPercent,
        expectedDeliveryDate: deliveryDate,
        createdBy: actor.id,
        createdAt: orderDate,
        approvalToken: approval.hash,
        approvalTokenEnc: approval.enc,
        approvalTokenExpiresAt: quotationApprovalExpiresAt(expiresAt),
      },
    });
    return { userId: user.id, profileId: profile.id, quote };
  });

  const partial = { clientId: created.profileId } as { clientId: string; orderId?: string };
  try {
    // 2. The commission: order code, invoice and intake stages from the website's own conversion.
    const converted = await convertQuotationToOrder(created.quote, actor.id);
    partial.orderId = converted.orderId;
    await prisma.bespokeOrder.update({
      where: { id: converted.orderId },
      data: {
        clientProfileId: created.profileId,
        title: k.title,
        garmentTypeId: k.garmentTypeId,
        occasionType: k.occasion,
        occasionDetails: k.description,
        outfitBrief: brief,
        clientLocation: place || null,
        eventLocation: k.eventLocation,
        eventDate: k.eventDate ? new Date(`${k.eventDate}T00:00:00.000Z`) : null,
        createdAt: orderDate,
      },
    });

    // 3. What she has paid, oldest first, through the ledger (as Invoice → Mark paid does).
    const invoice = await prisma.invoice.findFirst({ where: { quotationId: created.quote.id }, select: { id: true } });
    if (!invoice) throw new Error("conversion made no invoice");
    const payments = [...money.payments].sort((a, b) => a.date.localeCompare(b.date));
    for (const [i, p] of payments.entries()) {
      const reference = `MANUAL-${converted.orderRef}-${i + 1}`;
      const paidAt = day(p.date);
      const summary = await getInvoicePaymentSummary(invoice.id);
      const purpose =
        p.amount >= toNumber(summary.balance) - 0.01
          ? PaymentPurpose.FULL
          : toNumber(summary.confirmed) < toNumber(summary.depositRequired)
            ? PaymentPurpose.DEPOSIT
            : PaymentPurpose.BALANCE;
      await appendPayment({
        reference,
        amount: p.amount,
        currency: "NGN",
        method: PaymentMethod[p.method],
        status: PaymentStatus.CONFIRMED,
        purpose,
        invoiceId: invoice.id,
        bespokeOrderId: converted.orderId,
        clientId: created.userId,
        confirmedById: actor.id,
        confirmedAt: paidAt,
        createdAt: paidAt,
      });
      const fresh = await prisma.invoice.findUnique({ where: { id: invoice.id }, select: { paymentHistory: true } });
      const history = parseInvoicePaymentHistory(fresh?.paymentHistory);
      const methodLabel = p.method === "BANK_TRANSFER" ? "Bank Transfer" : "Cash / other";
      history.push({ recordedAt: paidAt.toISOString(), amount: p.amount, method: methodLabel, reference });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { paymentMethod: methodLabel, paymentRef: reference, paymentHistory: history as unknown as Prisma.InputJsonValue },
      });
    }

    // 4. Where the commission stands today.
    if (progress.currentStage !== BespokeStage.SKETCHING_CONCEPT) {
      const r = await recordProgressOutsideApp({
        orderId: converted.orderId,
        targetStage: progress.currentStage,
        actor,
        stages: progress.stages,
        reason: "client onboarded by hand",
      });
      if (!r.ok) throw new Error(r.error);
    }

    // 5. A note for the team: how she came in, and what is missing.
    const byName = actor.name?.trim() || actor.email || "Admin";
    await prisma.clientNote.create({
      data: {
        clientId: created.profileId,
        note: [
          `Onboarded by hand by ${byName} on ${new Date().toISOString().slice(0, 10)}, at ${STAGE_LABELS[progress.currentStage]}.`,
          placeholder
            ? `She has no email on file (placeholder ${email}). Until her real email is added she cannot sign in, no email reaches her, and approval links cannot be sent: record approvals given in person with “Record progress”.`
            : "Nothing was emailed to her.",
          c.phone ? "" : "Her phone number is missing.",
          payments.map((p) => p.note).filter(Boolean).join(" "),
          c.teamNote ?? "",
        ]
          .filter(Boolean)
          .join(" "),
        addedBy: actor.id,
        addedByName: byName,
      },
    });

    await logActivity({
      userId: actor.id,
      userEmail: actor.email ?? undefined,
      userRole: actor.role ?? undefined,
      action: "CREATE",
      module: "clients",
      description: `Client ${c.name} onboarded by hand with ${converted.orderRef} (${placeholder ? "no email" : email})`,
      recordId: created.profileId,
      recordType: "ClientProfile",
    });

    const result = await prisma.bespokeOrder.findUnique({ where: { id: converted.orderId }, select: { productionUnlockedAt: true } });
    return {
      ok: true,
      clientId: created.profileId,
      userId: created.userId,
      email,
      placeholder,
      orderId: converted.orderId,
      orderRef: converted.orderRef,
      invoiceNumber: converted.invoiceNumber,
      quoteRef: created.quote.quoteRef,
      productionUnlocked: !!result?.productionUnlockedAt,
    };
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: `Her account was made, but the commission could not be finished (${e instanceof Error ? e.message : "unknown error"}). Open her file to check it.`,
      partial,
      clientId: created.profileId,
    };
  }
}
