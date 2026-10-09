/**
 * Import atelier commissions the house took before the app (the "ORDERS 26" sheet).
 *
 *   tsx --tsconfig tsconfig.scripts.json scripts/import-atelier-orders.ts <data.json>           # dry run
 *   tsx --tsconfig tsconfig.scripts.json scripts/import-atelier-orders.ts <data.json> --apply   # write
 *
 * In a deployed container the image carries it bundled (pnpm bundle:import), since the
 * runtime image lacks the packages src/lib needs under tsx:
 *   docker cp data.json <container>:/tmp/data.json
 *   docker exec -w /app <container> node scripts/import-atelier-orders.cjs /tmp/data.json [--apply]
 *
 * Client data never enters the repository: the JSON is passed in. Per client, through
 * the app's own code paths:
 *   - a CUSTOMER account with no password and a placeholder `.invalid` email: it cannot
 *     sign in, and the outbox never queues mail for it (isUndeliverableAddress);
 *   - her place as a city-only default address ("Where clients are"), and a note for the
 *     team that her email and phone are missing;
 *   - an approved quotation, converted by convertQuotationToOrder (commission, invoice,
 *     intake stages), so the price has one source;
 *   - the payments she has made, appended to the ledger (which unlocks production);
 *   - the production stages before the one she is at, completed "before the app".
 *     No client approval is invented: Design Approval is recorded as given in person.
 *
 * Nothing is emailed, no payment link is made. Re-running resumes: each step finds
 * what it already wrote (account by email, quotation by email, payment by reference,
 * stage completion by stage, note by marker) and writes only what is missing.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BespokeStage, PaymentMethod, PaymentPurpose, PaymentStatus, QuoteStatus, Role, type Prisma } from "@prisma/client";

try {
  const require = createRequire(import.meta.url);
  const dotenv = require("dotenv") as typeof import("dotenv");
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
} catch {
  /* runtime image */
}

type ImportPayment = { amount: number; date: string; method: "BANK_TRANSFER" | "MANUAL" };
type ImportClient = {
  key: string;
  name: string;
  occasion: string;
  description: string;
  brief: string;
  orderDate: string;
  orderDateNote?: string;
  deliveryDate: string;
  city: string;
  state: string;
  country: string;
  charged: number;
  payments: ImportPayment[];
  stage: BespokeStage;
  progressNote?: string;
};
type ImportFile = { batch: string; source: string; clients: ImportClient[] };

const PLACEHOLDER_DOMAIN = "no-email.prudentgabriel.invalid";
const IMPORT_DAY = new Date().toISOString().slice(0, 10);

function day(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label}: "${value}" is not YYYY-MM-DD`);
  const d = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`${label}: "${value}" is not a date`);
  return d;
}

function naira(n: number): string {
  return `₦${n.toLocaleString("en-NG")}`;
}

function placeholderEmail(batch: string, key: string): string {
  return `${batch}-${key}@${PLACEHOLDER_DOMAIN}`.toLowerCase();
}

function marker(batch: string, key: string): string {
  return `[import:${batch}:${key}]`;
}

function validate(file: ImportFile, stageOrder: BespokeStage[]): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9-]+$/.test(file.batch ?? "")) problems.push(`batch "${file.batch}" must be lowercase letters, digits, dashes`);
  const keys = new Set<string>();
  for (const c of file.clients ?? []) {
    const who = c.key || c.name;
    if (!/^[a-z0-9-]+$/.test(c.key ?? "")) problems.push(`${who}: key must be lowercase letters, digits, dashes`);
    if (keys.has(c.key)) problems.push(`${who}: duplicate key`);
    keys.add(c.key);
    if (!c.name?.trim()) problems.push(`${who}: name missing`);
    try {
      day(c.orderDate, `${who} orderDate`);
      day(c.deliveryDate, `${who} deliveryDate`);
      for (const [i, p] of (c.payments ?? []).entries()) day(p.date, `${who} payment ${i + 1}`);
    } catch (e) {
      problems.push((e as Error).message);
    }
    if (!(c.charged > 0)) problems.push(`${who}: charged must be more than 0`);
    const paid = (c.payments ?? []).reduce((s, p) => s + p.amount, 0);
    if ((c.payments ?? []).some((p) => !(p.amount > 0))) problems.push(`${who}: every payment must be more than 0`);
    if (paid > c.charged) problems.push(`${who}: paid ${naira(paid)} is more than charged ${naira(c.charged)}`);
    if (!stageOrder.includes(c.stage)) problems.push(`${who}: unknown stage ${c.stage}`);
    else if (stageOrder.indexOf(c.stage) < stageOrder.indexOf(BespokeStage.SKETCHING_CONCEPT)) {
      problems.push(`${who}: stage must be Sketching or later (a converted commission starts there)`);
    }
    if (c.stage === BespokeStage.DELIVERY) problems.push(`${who}: Delivery is completed in the app, not imported`);
    if (!c.country?.trim()) problems.push(`${who}: country missing`);
  }
  return problems;
}

async function main() {
  const [dataPath, ...flags] = process.argv.slice(2);
  if (!dataPath) throw new Error("usage: import-atelier-orders.ts <data.json> [--apply]");
  const apply = flags.includes("--apply");
  const file = JSON.parse(readFileSync(dataPath, "utf8")) as ImportFile;

  const { prisma } = await import("../src/lib/prisma");
  const { STAGE_ORDER } = await import("../src/lib/bespoke-stages");
  const { convertQuotationToOrder } = await import("../src/lib/quotation-convert");
  const { allocateQuotationBaseRef, formatQuotationRef } = await import("../src/lib/document-numbers");
  const { generateCapabilityToken } = await import("../src/lib/capability-token");
  const { quotationApprovalExpiresAt } = await import("../src/lib/capability-token-lookup");
  const { defaultExpiresAt } = await import("../src/lib/document-validity");
  const { getInvoiceDefaultValidityDays, parseInvoicePaymentHistory } = await import("../src/lib/invoice");
  const { appendPayment, getBespokeDepositPercent, getInvoicePaymentSummary, toNumber } = await import(
    "../src/lib/payments/ledger"
  );
  const { isUndeliverableAddress } = await import("../src/lib/email-outbox");

  const problems = validate(file, STAGE_ORDER);
  if (problems.length) {
    console.error("The data has problems; nothing was written:\n  - " + problems.join("\n  - "));
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const actor = await prisma.user.findFirst({
    where: { role: { in: [Role.SUPER_ADMIN, Role.ADMIN] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!actor) throw new Error("No admin account to record the import as.");

  const dbHost = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/[/?].*$/, "");
  console.log(`${apply ? "APPLY" : "DRY RUN"} — ${file.clients.length} clients from "${file.source}"`);
  console.log(`Database host: ${dbHost || "(unknown)"} · recorded as: ${actor.name ?? actor.id}\n`);

  const sketching = STAGE_ORDER.indexOf(BespokeStage.SKETCHING_CONCEPT);

  for (const c of file.clients) {
    const email = placeholderEmail(file.batch, c.key);
    if (!isUndeliverableAddress(email)) throw new Error(`placeholder ${email} would be mailed`);
    const mark = marker(file.batch, c.key);
    const paid = c.payments.reduce((s, p) => s + p.amount, 0);
    const stagesBefore = STAGE_ORDER.slice(sketching, STAGE_ORDER.indexOf(c.stage));
    const place = [c.city, c.state, c.country].filter((p) => p.trim()).join(", ");

    console.log(`— ${c.name} (${c.occasion}) · ${email}`);
    console.log(`    ${c.description}; ordered ${c.orderDate}${c.orderDateNote ? ` (${c.orderDateNote})` : ""}; delivery ${c.deliveryDate}; ${place}`);
    console.log(`    charged ${naira(c.charged)} · paid ${naira(paid)} in ${c.payments.length} transfer(s) from ${c.payments[0]?.date ?? "—"} · balance ${naira(c.charged - paid)}`);
    console.log(`    at ${c.stage}; completed before the app: ${stagesBefore.join(", ") || "none"}`);

    const existingNote = await prisma.clientNote.findFirst({ where: { note: { contains: mark } }, select: { id: true } });
    if (existingNote) {
      console.log("    already imported — skipped\n");
      continue;
    }
    if (!apply) {
      console.log("");
      continue;
    }

    const orderDate = day(c.orderDate, "orderDate");
    const deliveryDate = new Date(`${c.deliveryDate}T00:00:00.000Z`);

    // 1. Her account and profile. No password: she cannot sign in until the team adds her real email.
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: c.name, role: Role.CUSTOMER, createdAt: orderDate },
      select: { id: true },
    });
    const profile = await prisma.clientProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, occasions: [c.occasion], createdAt: orderDate },
      select: { id: true },
    });
    const address = await prisma.address.findFirst({ where: { userId: user.id }, select: { id: true } });
    if (!address) {
      await prisma.address.create({
        data: {
          userId: user.id,
          label: "Imported (place only)",
          firstName: c.name,
          lastName: "",
          phone: "",
          street: "",
          city: c.city,
          state: c.state,
          country: c.country,
          isDefault: true,
        },
      });
    }

    // 2. An approved quotation, converted by the app's own code.
    const brief = [c.description, c.brief].filter((s) => s.trim()).join("\n\n");
    let quote = await prisma.quotation.findFirst({ where: { clientEmail: email }, orderBy: { createdAt: "asc" } });
    if (!quote) {
      const validityDays = await getInvoiceDefaultValidityDays();
      const depositPercent = await getBespokeDepositPercent();
      const expiresAt = defaultExpiresAt(orderDate, validityDays);
      quote = await prisma.$transaction(async (tx) => {
        const baseQuoteRef = await allocateQuotationBaseRef(tx);
        const approval = generateCapabilityToken();
        return tx.quotation.create({
          data: {
            quoteRef: formatQuotationRef(baseQuoteRef, 1),
            baseQuoteRef,
            version: 1,
            clientName: c.name,
            clientEmail: email,
            lineItems: [{ description: c.description, quantity: 1, unitPrice: c.charged, total: c.charged }] as unknown as Prisma.InputJsonValue,
            subtotal: c.charged,
            total: c.charged,
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
      });
    }
    let order = await prisma.bespokeOrder.findFirst({ where: { quotationId: quote.id }, select: { id: true, orderRef: true } });
    if (!order) {
      const converted = await convertQuotationToOrder(quote, actor.id);
      order = { id: converted.orderId, orderRef: converted.orderRef };
    }
    await prisma.bespokeOrder.update({
      where: { id: order.id },
      data: {
        clientProfileId: profile.id,
        occasionType: c.occasion,
        occasionDetails: c.description,
        clientLocation: place,
        outfitBrief: brief,
        createdAt: orderDate,
      },
    });

    // 3. What she has paid, through the ledger (as Admin → Invoice → Mark paid does).
    const invoice = await prisma.invoice.findFirst({ where: { quotationId: quote.id }, select: { id: true, paymentHistory: true } });
    if (!invoice) throw new Error(`${c.name}: conversion made no invoice`);
    for (const [i, p] of c.payments.entries()) {
      const reference = `IMPORT-${file.batch.toUpperCase()}-${c.key.toUpperCase()}-${i + 1}`;
      if (await prisma.payment.findFirst({ where: { reference }, select: { id: true } })) continue;
      const paidAt = day(p.date, "payment");
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
        bespokeOrderId: order.id,
        clientId: user.id,
        confirmedById: actor.id,
        confirmedAt: paidAt,
        createdAt: paidAt,
      });
      const fresh = await prisma.invoice.findUnique({ where: { id: invoice.id }, select: { paymentHistory: true } });
      const history = parseInvoicePaymentHistory(fresh?.paymentHistory);
      history.push({ recordedAt: paidAt.toISOString(), amount: p.amount, method: "Bank Transfer", reference });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { paymentMethod: "Bank Transfer", paymentRef: reference, paymentHistory: history as unknown as Prisma.InputJsonValue },
      });
    }

    // 4. The stages done before the app, written as completeOrderStage writes them.
    //    Stage notes are shown to her on her dashboard: plain words only. Where they
    //    came from is in the team's client note (step 5).
    for (const stage of stagesBefore) {
      const done = await prisma.orderStageCompletion.findFirst({ where: { orderId: order.id, stage, revertedAt: null }, select: { id: true } });
      if (done) continue;
      const notes = stage === BespokeStage.DESIGN_APPROVAL ? "Design approved in person." : "Completed.";
      await prisma.stageUpdate.create({
        data: { orderId: order.id, stage, notes, images: [], videos: [], completedBy: actor.id, completedByName: "Import" },
      });
      await prisma.orderStageCompletion.create({ data: { orderId: order.id, stage, completedById: actor.id, notes } });
    }
    await prisma.bespokeOrder.update({ where: { id: order.id }, data: { currentStage: c.stage } });

    // 5. The note for the team, last: its marker means "this client is fully imported".
    await prisma.clientNote.create({
      data: {
        clientId: profile.id,
        note: [
          `${mark} Imported on ${IMPORT_DAY} from ${file.source}.`,
          `Stages before ${c.stage} were completed before the app and recorded as "Completed." (Design Approval: "Design approved in person."; no approval link was sent).`,
          "Her email and phone are missing: add them to her account and to the commission. Until then she cannot sign in, no email reaches her, and the Design Approval and Final Fitting links cannot be sent.",
          c.orderDateNote ?? "",
          c.progressNote ?? "",
        ]
          .filter(Boolean)
          .join(" "),
        addedBy: actor.id,
        addedByName: "Import",
      },
    });

    const result = await prisma.bespokeOrder.findUnique({
      where: { id: order.id },
      select: { orderRef: true, totalAmount: true, amountPaid: true, balance: true, currentStage: true, productionUnlockedAt: true, deliveryDate: true },
    });
    console.log(
      `    WRITTEN ${result?.orderRef}: total ${naira(result?.totalAmount ?? 0)}, paid ${naira(result?.amountPaid ?? 0)}, balance ${naira(result?.balance ?? 0)}, ` +
        `${result?.currentStage}, production ${result?.productionUnlockedAt ? "unlocked" : "LOCKED"}, delivery ${result?.deliveryDate?.toISOString().slice(0, 10)}\n`,
    );
  }

  if (!apply) console.log("Dry run: nothing written. Add --apply to write.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
