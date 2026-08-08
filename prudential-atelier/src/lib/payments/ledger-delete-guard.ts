import { Prisma } from "@prisma/client";

/** User-facing message when RESTRICT FK on Payment blocks a hard delete. */
export function paymentLedgerDeleteBlockedMessage(entityLabel: string): string {
  return `This ${entityLabel} has payment records and cannot be deleted. Cancel it instead.`;
}

export function isPrismaForeignKeyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003"
  );
}

/**
 * Run a hard-delete. On Payment RESTRICT (P2003), return a 409-shaped payload
 * instead of a raw 500.
 */
export function mapLedgerDeleteError(
  error: unknown,
  entityLabel: string,
): { status: 409; body: { error: string } } | null {
  if (!isPrismaForeignKeyError(error)) return null;
  return {
    status: 409,
    body: { error: paymentLedgerDeleteBlockedMessage(entityLabel) },
  };
}
