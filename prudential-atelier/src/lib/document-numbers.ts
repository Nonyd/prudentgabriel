import { nanoid } from "nanoid";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SHORT_INTERACTIVE_TX } from "@/lib/prisma-tx";
import { getSetting } from "@/lib/settings";

export type DocumentNumberKind = "invoice" | "quotation";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Allocate the next monotonic number for a document kind + year.
 * Uses INSERT … ON CONFLICT + UPDATE … RETURNING under the caller's transaction
 * (or a short interactive transaction when called without one).
 * Gaps after deletes are intentional; reuse is not.
 */
export async function allocateDocumentSequence(
  kind: DocumentNumberKind,
  year: number,
  client?: DbClient,
): Promise<number> {
  const run = async (tx: Prisma.TransactionClient): Promise<number> => {
    const id = nanoid();
    await tx.$executeRaw`
      INSERT INTO "DocumentNumberSequence" (id, kind, year, "lastValue")
      VALUES (${id}, ${kind}, ${year}, 0)
      ON CONFLICT (kind, year) DO NOTHING
    `;
    const rows = await tx.$queryRaw<Array<{ lastValue: number }>>`
      UPDATE "DocumentNumberSequence"
      SET "lastValue" = "lastValue" + 1
      WHERE kind = ${kind} AND year = ${year}
      RETURNING "lastValue"
    `;
    const value = rows[0]?.lastValue;
    if (value == null || !Number.isFinite(Number(value))) {
      throw new Error(`Failed to allocate ${kind} number for ${year}`);
    }
    return Number(value);
  };

  if (client && client !== prisma) {
    return run(client as Prisma.TransactionClient);
  }
  return prisma.$transaction((tx) => run(tx), SHORT_INTERACTIVE_TX);
}

export async function formatInvoiceNumber(
  sequence: number,
  year = new Date().getFullYear(),
  prefix?: string,
): Promise<string> {
  const raw = (prefix ?? (await getSetting("invoice_prefix"))?.trim()) || "PA-INV";
  const p = raw.replace(/-+$/, "");
  return `${p}-${year}-${String(sequence).padStart(4, "0")}`;
}

export function formatQuotationBaseRef(sequence: number, year = new Date().getFullYear()): string {
  return `QT-${year}-${String(sequence).padStart(4, "0")}`;
}

export function formatQuotationRef(baseQuoteRef: string, version: number): string {
  if (version <= 1) return baseQuoteRef;
  return `${baseQuoteRef}-v${version}`;
}

export async function allocateInvoiceNumber(client?: DbClient): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await allocateDocumentSequence("invoice", year, client);
  return formatInvoiceNumber(seq, year);
}

export async function allocateQuotationBaseRef(client?: DbClient): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await allocateDocumentSequence("quotation", year, client);
  return formatQuotationBaseRef(seq, year);
}
