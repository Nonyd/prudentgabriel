import { PaymentGateway } from "@prisma/client";
import { timingSafeEqualString } from "@/lib/crypto-compare";
import { logError } from "@/lib/logger";

export type PaymentBindCode = "REFERENCE_MISMATCH" | "AMOUNT_MISMATCH" | "CURRENCY_MISMATCH";

export class PaymentBindError extends Error {
  readonly code: PaymentBindCode;

  constructor(code: PaymentBindCode, message: string) {
    super(message);
    this.name = "PaymentBindError";
    this.code = code;
  }
}

export type BindTarget = {
  id: string;
  storedReference: string | null;
  /** Amount this charge must cover, in PSP units. For RTW that is the outstanding balance (equals total when unpaid). */
  expectedAmount: number;
  expectedCurrency: string;
};

export type PspCharge = {
  gateway: PaymentGateway;
  reference: string;
  /** Paystack: kobo. Stripe: minor unit. Flutterwave / Monnify: major unit. */
  amount: number;
  currency: string;
  metadataEntityId?: string | null;
};

function normCurrency(c: string): string {
  return c.trim().toUpperCase();
}

export function expectedAmountInPspUnits(
  gateway: PaymentGateway,
  majorUnits: number,
): number {
  switch (gateway) {
    case PaymentGateway.PAYSTACK:
    case PaymentGateway.STRIPE:
      return Math.round(majorUnits * 100);
    case PaymentGateway.FLUTTERWAVE:
    case PaymentGateway.MONNIFY:
      return Math.round(majorUnits * 100) / 100;
    default:
      return Math.round(majorUnits * 100) / 100;
  }
}

/**
 * Must not underpay `expected`. `expected` is the amount owed on this charge
 * (outstanding balance for an RTW top-up, full total on first payment).
 * A floor (`>=`) survives kobo/FX rounding; a ceiling of `order.total` would
 * accept a ₦1 charge against a ₦495,000 order.
 */
function amountMeetsExpected(gateway: PaymentGateway, pspAmount: number, expected: number): boolean {
  if (!Number.isFinite(pspAmount) || !Number.isFinite(expected)) return false;
  switch (gateway) {
    case PaymentGateway.PAYSTACK:
    case PaymentGateway.STRIPE:
      return Math.round(pspAmount) >= Math.round(expected);
    default:
      return Math.round(pspAmount * 100) >= Math.round(expected * 100);
  }
}

export function reportPaymentBindFailure(params: {
  code: PaymentBindCode;
  entityId: string;
  gateway: PaymentGateway;
  detail: string;
}): void {
  void logError({
    severity: "CRITICAL",
    errorType: `PAYMENT_BIND_${params.code}`,
    message: params.detail,
    orderId: params.entityId,
    url: `gateway:${params.gateway}`,
  });
}

/**
 * Bind a PSP charge to a stored order/booking.
 * Identity: metadata entity id match **or** stored PSP reference match.
 * A client-supplied id with an unrelated reference is rejected.
 */
export function assertPspChargeBinds(
  target: BindTarget,
  charge: PspCharge,
  opts?: { log?: boolean },
): void {
  const metaOk = Boolean(
    charge.metadataEntityId && charge.metadataEntityId === target.id,
  );
  const stored = target.storedReference?.trim() ?? "";
  const refOk = Boolean(stored && timingSafeEqualString(stored, charge.reference.trim()));
  const log = opts?.log !== false;

  if (!metaOk && !refOk) {
    const err = new PaymentBindError(
      "REFERENCE_MISMATCH",
      `PSP reference does not belong to entity ${target.id}`,
    );
    if (log) {
      reportPaymentBindFailure({
        code: err.code,
        entityId: target.id,
        gateway: charge.gateway,
        detail: `${err.message} pspRef=${charge.reference} storedRef=${stored || "<none>"} meta=${charge.metadataEntityId ?? "<none>"}`,
      });
    }
    throw err;
  }

  const expectedCur = normCurrency(target.expectedCurrency);
  const pspCur = normCurrency(charge.currency);
  if (expectedCur !== pspCur) {
    const err = new PaymentBindError(
      "CURRENCY_MISMATCH",
      `PSP currency ${pspCur} does not match expected ${expectedCur}`,
    );
    if (log) {
      reportPaymentBindFailure({
        code: err.code,
        entityId: target.id,
        gateway: charge.gateway,
        detail: err.message,
      });
    }
    throw err;
  }

  if (!amountMeetsExpected(charge.gateway, charge.amount, target.expectedAmount)) {
    const err = new PaymentBindError(
      "AMOUNT_MISMATCH",
      `PSP amount ${charge.amount} is below expected ${target.expectedAmount} (${charge.gateway} ${pspCur})`,
    );
    if (log) {
      reportPaymentBindFailure({
        code: err.code,
        entityId: target.id,
        gateway: charge.gateway,
        detail: err.message,
      });
    }
    throw err;
  }
}
