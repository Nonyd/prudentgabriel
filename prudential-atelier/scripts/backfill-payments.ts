/**
 * Backfill Payment ledger rows from legacy caches:
 *   - BespokeOrder.amountPaid
 *   - Invoice.paymentHistory
 *   - ConsultationBooking (paymentStatus = PAID)
 *
 * An invoice payment fulfils its bespoke order — that is ONE payment, not two.
 * Paired entities therefore emit a single row carrying BOTH foreign keys.
 * Pairing is STRUCTURAL only (quotationId / consultationId / bespokeRequestId,
 * or a human-confirmed map). Never pair on reference-string similarity.
 *
 * Default mode is PLAN ONLY — nothing is written. Review the plan, then re-run
 * with --apply.
 *
 *   pnpm backfill:payments            # plan only
 *   pnpm backfill:payments --apply    # write rows
 *
 * Idempotent: every row has a deterministic reference and is upserted
 * individually, so a run that dies halfway can be re-run safely.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();
const D = Prisma.Decimal;

const APPLY = process.argv.includes("--apply");
const ALLOW_SUSPECTED = process.argv.includes("--allow-suspected-duplicates");
const MONEY_EPSILON = 0.02;

type Decision = "PAIRED" | "ORDER_ONLY" | "INVOICE_ONLY" | "CONSULTATION" | "SUSPECTED_DUPLICATE";

type PlannedRow = {
  reference: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  purpose: PaymentPurpose;
  clientId: string;
  bespokeOrderId: string | null;
  invoiceId: string | null;
  consultationId: string | null;
  createdAt: Date;
  confirmedAt: Date;
  source: string;
};

type PlanEntity = {
  kind: "order" | "invoice" | "consultation";
  id: string;
  ref: string;
  decision: Decision;
  pairedWith?: string;
  cachedPaid: number;
  rows: PlannedRow[];
  note?: string;
};

type HistoryEntry = { recordedAt: string; amount: number; method: string; reference?: string };

function parseHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => {
      const r = e as Partial<HistoryEntry>;
      return {
        recordedAt: String(r.recordedAt ?? new Date().toISOString()),
        amount: Number(r.amount) || 0,
        method: String(r.method ?? "MANUAL"),
        reference: r.reference,
      };
    })
    .filter((e) => e.amount > 0);
}

function mapMethod(method: string): PaymentMethod {
  const m = method.toUpperCase().replace(/\s+/g, "_");
  if (m.includes("PAYSTACK")) return PaymentMethod.PAYSTACK;
  if (m.includes("FLUTTER")) return PaymentMethod.FLUTTERWAVE;
  if (m.includes("STRIPE")) return PaymentMethod.STRIPE;
  if (m.includes("MONNIFY")) return PaymentMethod.MONNIFY;
  if (m.includes("BANK") || m.includes("TRANSFER")) return PaymentMethod.BANK_TRANSFER;
  return PaymentMethod.MANUAL;
}

function safeDate(value: string | Date | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

async function resolveClientId(email: string, userId?: string | null): Promise<string> {
  if (userId) return userId;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  return user?.id ?? `email:${email.toLowerCase()}`;
}

/** Human-confirmed pairs, keyed by human-readable refs for reviewability. */
function loadManualPairs(): { orderRef: string; invoiceNumber: string; evidence?: string }[] {
  try {
    const raw = readFileSync(join(__dirname, "backfill-pairs.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      pairs?: { orderRef: string; invoiceNumber: string; evidence?: string }[];
    };
    return parsed.pairs ?? [];
  } catch {
    return [];
  }
}

async function main() {
  console.log(APPLY ? "MODE: APPLY (writes enabled)" : "MODE: PLAN ONLY (no writes)");

  const orders = await prisma.bespokeOrder.findMany({
    select: {
      id: true,
      orderRef: true,
      amountPaid: true,
      totalAmount: true,
      clientEmail: true,
      updatedAt: true,
      quotationId: true,
      consultationId: true,
      bespokeRequestId: true,
      productionUnlockedAt: true,
    },
  });

  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      depositPaid: true,
      total: true,
      clientEmail: true,
      currency: true,
      paymentHistory: true,
      quotationId: true,
      consultationId: true,
      bespokeRequestId: true,
      createdAt: true,
    },
  });

  const consultations = await prisma.consultationBooking.findMany({
    where: { paymentStatus: PaymentStatus.PAID },
    select: {
      id: true,
      bookingNumber: true,
      clientEmail: true,
      feeNGN: true,
      paymentGateway: true,
      paymentRef: true,
      paidAt: true,
      createdAt: true,
      userId: true,
    },
  });

  // ---------------------------------------------------------------- pairing
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const invoiceToOrder = new Map<string, string>();
  const orderToInvoice = new Map<string, string>();
  const pairBasis = new Map<string, string>();

  function link(orderId: string, invoiceId: string, basis: string) {
    if (orderToInvoice.has(orderId) || invoiceToOrder.has(invoiceId)) return;
    orderToInvoice.set(orderId, invoiceId);
    invoiceToOrder.set(invoiceId, orderId);
    pairBasis.set(invoiceId, basis);
  }

  // Structural tiers, strongest first. Only 1:1 matches are accepted.
  const tiers: { key: "quotationId" | "consultationId" | "bespokeRequestId"; label: string }[] = [
    { key: "quotationId", label: "quotationId" },
    { key: "consultationId", label: "consultationId" },
    { key: "bespokeRequestId", label: "bespokeRequestId" },
  ];

  for (const tier of tiers) {
    for (const inv of invoices) {
      const value = inv[tier.key];
      if (!value || invoiceToOrder.has(inv.id)) continue;
      const candidates = orders.filter((o) => o[tier.key] === value && !orderToInvoice.has(o.id));
      if (candidates.length === 1) {
        link(candidates[0]!.id, inv.id, tier.label);
      }
    }
  }

  for (const manual of loadManualPairs()) {
    const o = orders.find((x) => x.orderRef === manual.orderRef);
    const inv = invoices.find((x) => x.invoiceNumber === manual.invoiceNumber);
    if (!o || !inv) {
      console.warn(
        `  ! manual pair ${manual.orderRef} <-> ${manual.invoiceNumber} skipped: entity not found`,
      );
      continue;
    }
    link(o.id, inv.id, `confirmed:${manual.evidence ?? "manual"}`);
  }

  // Suspected duplicates: same client + same total + both hold money, but no
  // structural link. NEVER auto-paired — requires a human decision.
  const suspected: { order: (typeof orders)[number]; invoice: (typeof invoices)[number] }[] = [];
  for (const inv of invoices) {
    if (invoiceToOrder.has(inv.id)) continue;
    const invPaid = inv.depositPaid;
    if (invPaid <= 0) continue;
    const matches = orders.filter(
      (o) =>
        !orderToInvoice.has(o.id) &&
        o.amountPaid > 0 &&
        o.clientEmail.toLowerCase() === inv.clientEmail.toLowerCase() &&
        Math.abs(o.totalAmount - inv.total) < MONEY_EPSILON,
    );
    if (matches.length === 1) suspected.push({ order: matches[0]!, invoice: inv });
  }
  const suspectedOrderIds = new Set(suspected.map((s) => s.order.id));
  const suspectedInvoiceIds = new Set(suspected.map((s) => s.invoice.id));

  // ------------------------------------------------------------ build plan
  const plan: PlanEntity[] = [];

  for (const inv of invoices) {
    const history = parseHistory(inv.paymentHistory);
    const pairedOrderId = invoiceToOrder.get(inv.id) ?? null;
    const order = pairedOrderId ? orderById.get(pairedOrderId)! : null;
    const isSuspect = suspectedInvoiceIds.has(inv.id);

    const clientId = await resolveClientId(inv.clientEmail);
    const rows: PlannedRow[] = [];

    if (!isSuspect) {
      if (history.length > 0) {
        let running = 0;
        for (let i = 0; i < history.length; i++) {
          const entry = history[i]!;
          const at = safeDate(entry.recordedAt, inv.createdAt);
          const depositTarget = order ? order.totalAmount : inv.total;
          running += entry.amount;
          rows.push({
            reference: `BACKFILL-INV-${inv.id}-${i + 1}`,
            amount: entry.amount,
            currency: inv.currency || "NGN",
            method: mapMethod(entry.method),
            purpose:
              running >= depositTarget - MONEY_EPSILON
                ? PaymentPurpose.FULL
                : i === 0
                  ? PaymentPurpose.DEPOSIT
                  : PaymentPurpose.BALANCE,
            clientId,
            bespokeOrderId: pairedOrderId,
            invoiceId: inv.id,
            consultationId: null,
            createdAt: at,
            confirmedAt: at,
            source: "invoice.paymentHistory",
          });
        }
      } else if (inv.depositPaid > 0) {
        // Cached money with no itemised history.
        const at = inv.createdAt;
        rows.push({
          reference: `BACKFILL-INV-${inv.id}-1`,
          amount: inv.depositPaid,
          currency: inv.currency || "NGN",
          method: PaymentMethod.MANUAL,
          purpose:
            inv.depositPaid >= inv.total - MONEY_EPSILON
              ? PaymentPurpose.FULL
              : PaymentPurpose.DEPOSIT,
          clientId,
          bespokeOrderId: pairedOrderId,
          invoiceId: inv.id,
          consultationId: null,
          createdAt: at,
          confirmedAt: at,
          source: "invoice.depositPaid",
        });
      }
    }

    plan.push({
      kind: "invoice",
      id: inv.id,
      ref: inv.invoiceNumber,
      decision: isSuspect ? "SUSPECTED_DUPLICATE" : pairedOrderId ? "PAIRED" : "INVOICE_ONLY",
      pairedWith: order?.orderRef,
      cachedPaid: inv.depositPaid,
      rows,
      note: isSuspect
        ? `same client+total as ${suspected.find((s) => s.invoice.id === inv.id)!.order.orderRef} but no structural link`
        : pairedOrderId
          ? `pair basis: ${pairBasis.get(inv.id)}`
          : undefined,
    });
  }

  for (const o of orders) {
    const pairedInvoiceId = orderToInvoice.get(o.id) ?? null;
    const isSuspect = suspectedOrderIds.has(o.id);

    // Paired orders are represented by the invoice-sourced rows above.
    if (pairedInvoiceId) {
      const invoiceEntity = plan.find((p) => p.kind === "invoice" && p.id === pairedInvoiceId)!;
      plan.push({
        kind: "order",
        id: o.id,
        ref: o.orderRef,
        decision: "PAIRED",
        pairedWith: invoiceEntity.ref,
        cachedPaid: o.amountPaid,
        rows: [],
        note: `money recorded on ${invoiceEntity.ref} rows (both FKs set)`,
      });
      continue;
    }

    const rows: PlannedRow[] = [];
    if (!isSuspect && o.amountPaid > 0) {
      const clientId = await resolveClientId(o.clientEmail);
      rows.push({
        reference: `BACKFILL-BO-${o.id}`,
        amount: o.amountPaid,
        currency: "NGN",
        method: PaymentMethod.MANUAL,
        purpose:
          o.amountPaid >= o.totalAmount - MONEY_EPSILON
            ? PaymentPurpose.FULL
            : PaymentPurpose.DEPOSIT,
        clientId,
        bespokeOrderId: o.id,
        invoiceId: null,
        consultationId: null,
        createdAt: o.updatedAt,
        confirmedAt: o.updatedAt,
        source: "bespokeOrder.amountPaid",
      });
    }

    plan.push({
      kind: "order",
      id: o.id,
      ref: o.orderRef,
      decision: isSuspect ? "SUSPECTED_DUPLICATE" : "ORDER_ONLY",
      cachedPaid: o.amountPaid,
      rows,
      note: isSuspect
        ? `same client+total as ${suspected.find((s) => s.order.id === o.id)!.invoice.invoiceNumber} but no structural link`
        : undefined,
    });
  }

  for (const c of consultations) {
    const clientId = await resolveClientId(c.clientEmail, c.userId);
    const at = safeDate(c.paidAt, c.createdAt);
    plan.push({
      kind: "consultation",
      id: c.id,
      ref: c.bookingNumber,
      decision: "CONSULTATION",
      cachedPaid: c.feeNGN,
      rows:
        c.feeNGN > 0
          ? [
              {
                reference: `BACKFILL-CB-${c.id}`,
                amount: c.feeNGN,
                currency: "NGN",
                method: mapMethod(c.paymentGateway ?? "MANUAL"),
                purpose: PaymentPurpose.CONSULTATION,
                clientId,
                bespokeOrderId: null,
                invoiceId: null,
                consultationId: c.id,
                createdAt: at,
                confirmedAt: at,
                source: "consultationBooking.feeNGN",
              },
            ]
          : [],
    });
  }

  // ------------------------------------------------------------ print plan
  console.log("\n=== PAIRING PLAN ===");
  console.log(
    [
      "kind".padEnd(13),
      "ref".padEnd(20),
      "decision".padEnd(20),
      "pairedWith".padEnd(12),
      "rows".padStart(5),
      "cached".padStart(13),
      "planned".padStart(13),
    ].join("  "),
  );
  for (const p of plan.sort((a, b) => a.kind.localeCompare(b.kind) || a.ref.localeCompare(b.ref))) {
    const planned = p.rows.reduce((s, r) => s + r.amount, 0);
    console.log(
      [
        p.kind.padEnd(13),
        p.ref.slice(0, 20).padEnd(20),
        p.decision.padEnd(20),
        (p.pairedWith ?? "—").slice(0, 12).padEnd(12),
        String(p.rows.length).padStart(5),
        p.cachedPaid.toFixed(2).padStart(13),
        planned.toFixed(2).padStart(13),
      ].join("  "),
    );
    if (p.note) console.log(`${" ".repeat(15)}↳ ${p.note}`);
  }

  const plannedRows = plan.flatMap((p) => p.rows);
  const plannedTotal = plannedRows.reduce((s, r) => s + r.amount, 0);
  console.log(`\nPlanned rows: ${plannedRows.length}`);
  console.log(`Planned SUM(amount): ${plannedTotal.toFixed(2)}`);
  const byDecision = plan.reduce<Record<string, number>>((acc, p) => {
    acc[p.decision] = (acc[p.decision] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Decisions: ${JSON.stringify(byDecision)}`);

  if (suspected.length > 0 && !ALLOW_SUSPECTED) {
    console.error(
      `\n!!! ${suspected.length} SUSPECTED DUPLICATE PAIR(S) — no structural link, identical client and total.`,
    );
    for (const s of suspected) {
      console.error(
        `    ${s.order.orderRef} (paid ${s.order.amountPaid}) <-> ${s.invoice.invoiceNumber} (paid ${s.invoice.depositPaid}) — client ${s.invoice.clientEmail}`,
      );
    }
    console.error(
      "    Resolve by adding confirmed pairs to scripts/backfill-pairs.json, or re-run with --allow-suspected-duplicates to treat them as INDEPENDENT payments.",
    );
    process.exit(1);
  }

  if (!APPLY) {
    console.log("\nPLAN ONLY — no rows written. Re-run with --apply to write.");
    return;
  }

  // ----------------------------------------------------------------- apply
  let created = 0;
  let existing = 0;

  for (const row of plannedRows) {
    // Per-row upsert on the deterministic reference. No entity-level skip:
    // a run that died halfway must be able to fill in only the missing rows.
    const found = await prisma.payment.findUnique({ where: { reference: row.reference } });
    if (found) {
      if (Math.abs(Number(found.amount) - row.amount) > MONEY_EPSILON) {
        throw new Error(
          `Backfill collision on ${row.reference}: existing amount ${found.amount} ≠ planned ${row.amount}`,
        );
      }
      existing += 1;
      continue;
    }
    await prisma.payment.create({
      data: {
        reference: row.reference,
        amount: new D(row.amount.toFixed(2)),
        currency: row.currency,
        method: row.method,
        status: PaymentStatus.CONFIRMED,
        purpose: row.purpose,
        bespokeOrderId: row.bespokeOrderId,
        invoiceId: row.invoiceId,
        consultationId: row.consultationId,
        clientId: row.clientId,
        confirmedAt: row.confirmedAt,
        createdAt: row.createdAt,
      },
    });
    created += 1;
  }

  // Refresh denormalised caches from the ledger.
  for (const o of orders) {
    const rows = await prisma.payment.findMany({
      where: { bespokeOrderId: o.id, status: PaymentStatus.CONFIRMED },
      select: { amount: true, confirmedAt: true, createdAt: true },
      orderBy: [{ confirmedAt: "asc" }, { createdAt: "asc" }],
    });
    const confirmed = rows.reduce((s, r) => s + Number(r.amount), 0);
    await prisma.bespokeOrder.update({
      where: { id: o.id },
      data: {
        amountPaid: confirmed,
        balance: Math.max(0, o.totalAmount - confirmed),
        productionUnlockedAt:
          o.productionUnlockedAt ??
          (rows.length > 0 ? (rows[0]!.confirmedAt ?? rows[0]!.createdAt) : null),
      },
    });
  }
  for (const inv of invoices) {
    const rows = await prisma.payment.findMany({
      where: { invoiceId: inv.id, status: PaymentStatus.CONFIRMED },
      select: { amount: true },
    });
    const confirmed = rows.reduce((s, r) => s + Number(r.amount), 0);
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { depositPaid: confirmed, balanceDue: Math.max(0, inv.total - confirmed) },
    });
  }

  console.log(`\nCreated ${created} row(s); ${existing} already present (idempotent).`);

  // -------------------------------------------------------- reconciliation
  console.log("\n=== RECONCILIATION (cached vs ledger) ===");
  console.log(
    [
      "kind".padEnd(13),
      "ref".padEnd(20),
      "decision".padEnd(20),
      "rows".padStart(5),
      "cached".padStart(13),
      "ledger".padStart(13),
      "ok",
    ].join("  "),
  );

  let mismatches = 0;
  for (const p of plan) {
    let ledger = 0;
    let rowCount = 0;
    if (p.kind === "order") {
      const rows = await prisma.payment.findMany({
        where: { bespokeOrderId: p.id, status: PaymentStatus.CONFIRMED },
        select: { amount: true },
      });
      rowCount = rows.length;
      ledger = rows.reduce((s, r) => s + Number(r.amount), 0);
    } else if (p.kind === "invoice") {
      const rows = await prisma.payment.findMany({
        where: { invoiceId: p.id, status: PaymentStatus.CONFIRMED },
        select: { amount: true },
      });
      rowCount = rows.length;
      ledger = rows.reduce((s, r) => s + Number(r.amount), 0);
    } else {
      const rows = await prisma.payment.findMany({
        where: { consultationId: p.id, status: PaymentStatus.CONFIRMED },
        select: { amount: true },
      });
      rowCount = rows.length;
      ledger = rows.reduce((s, r) => s + Number(r.amount), 0);
    }

    const cached =
      p.kind === "order"
        ? (await prisma.bespokeOrder.findUnique({ where: { id: p.id }, select: { amountPaid: true } }))!.amountPaid
        : p.kind === "invoice"
          ? (await prisma.invoice.findUnique({ where: { id: p.id }, select: { depositPaid: true } }))!.depositPaid
          : p.cachedPaid;

    const ok = Math.abs(cached - ledger) < MONEY_EPSILON;
    if (!ok) mismatches += 1;
    console.log(
      [
        p.kind.padEnd(13),
        p.ref.slice(0, 20).padEnd(20),
        p.decision.padEnd(20),
        String(rowCount).padStart(5),
        cached.toFixed(2).padStart(13),
        ledger.toFixed(2).padStart(13),
        ok ? "OK" : "MISMATCH",
      ].join("  "),
    );
  }

  const agg = await prisma.payment.aggregate({
    _sum: { amount: true },
    _count: true,
    where: { status: PaymentStatus.CONFIRMED },
  });
  console.log(`\nLedger rows: ${agg._count}`);
  console.log(`Ledger SUM(amount): ${Number(agg._sum.amount ?? 0).toFixed(2)}`);

  if (mismatches > 0) {
    console.error(`\n!!! ${mismatches} MISMATCH(ES) — backfill not successful.`);
    process.exit(1);
  }
  console.log("\nReconciliation OK — all entities match.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
