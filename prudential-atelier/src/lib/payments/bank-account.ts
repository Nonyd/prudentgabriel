import type { BankAccount, BankAccountCurrency, BusinessLine, WireFeeBearer } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const BANK_ACCOUNT_CURRENCIES = ["NGN", "USD", "GBP", "EUR"] as const;
export type BankAccountCurrencyCode = (typeof BANK_ACCOUNT_CURRENCIES)[number];

export const STOREFRONT_CURRENCIES = ["NGN", "USD", "GBP"] as const;
export type StorefrontCurrency = (typeof STOREFRONT_CURRENCIES)[number];

export const BUSINESS_LINES = ["RTW", "ATELIER"] as const;
export type BusinessLineCode = (typeof BUSINESS_LINES)[number];

export const WIRE_FEE_BEARERS = ["CUSTOMER", "HOUSE", "SHARED"] as const;
export type WireFeeBearerCode = (typeof WIRE_FEE_BEARERS)[number];

const DUMMY_ACCOUNT_NUMBERS = new Set(["0123456789", "0000000000"]);

export type ResolvedBankAccount = {
  id: string;
  currency: BankAccountCurrencyCode;
  businessLine: BusinessLineCode;
  accountName: string;
  accountNumber: string;
  bankName: string;
  swiftBic: string | null;
  iban: string | null;
  sortCode: string | null;
  routingNumber: string | null;
  intermediaryBank: string | null;
  instructions: string | null;
  feeBearer: WireFeeBearerCode | null;
  feeTolerance: number | null;
  isActive: boolean;
};

/** Fields shown to a customer — blanks omitted by the renderer, never by this shape. */
export type PublicBankAccount = {
  id: string;
  currency: BankAccountCurrencyCode;
  businessLine: BusinessLineCode;
  bankName: string;
  accountName: string;
  accountNumber: string;
  swiftBic?: string;
  iban?: string;
  sortCode?: string;
  routingNumber?: string;
  intermediaryBank?: string;
  instructions?: string;
  feeBearer?: WireFeeBearerCode;
  feeTolerance?: number;
};

export function isBankAccountCurrency(v: string): v is BankAccountCurrencyCode {
  return (BANK_ACCOUNT_CURRENCIES as readonly string[]).includes(v);
}

export function isBusinessLine(v: string): v is BusinessLineCode {
  return (BUSINESS_LINES as readonly string[]).includes(v);
}

export function parseBankAccountCurrency(v: string | null | undefined): BankAccountCurrencyCode | null {
  if (!v) return null;
  const u = v.trim().toUpperCase();
  return isBankAccountCurrency(u) ? u : null;
}

export function parseBusinessLine(v: string | null | undefined): BusinessLineCode | null {
  if (!v) return null;
  const u = v.trim().toUpperCase();
  return isBusinessLine(u) ? u : null;
}

function toResolved(row: BankAccount): ResolvedBankAccount {
  return {
    id: row.id,
    currency: row.currency as BankAccountCurrencyCode,
    businessLine: row.businessLine as BusinessLineCode,
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    bankName: row.bankName,
    swiftBic: row.swiftBic,
    iban: row.iban,
    sortCode: row.sortCode,
    routingNumber: row.routingNumber,
    intermediaryBank: row.intermediaryBank,
    instructions: row.instructions,
    feeBearer: (row.feeBearer as WireFeeBearerCode | null) ?? null,
    feeTolerance: row.feeTolerance != null ? Number(row.feeTolerance) : null,
    isActive: row.isActive,
  };
}

export function isUsableBankAccount(row: {
  accountNumber: string;
  bankName: string;
  accountName: string;
  isActive?: boolean;
}): boolean {
  if (row.isActive === false) return false;
  const number = row.accountNumber.trim();
  const bank = row.bankName.trim();
  const name = row.accountName.trim();
  if (!number || !bank || !name) return false;
  if (DUMMY_ACCOUNT_NUMBERS.has(number)) return false;
  return true;
}

export function toPublicBankAccount(row: ResolvedBankAccount): PublicBankAccount | null {
  if (!isUsableBankAccount(row)) return null;
  const pub: PublicBankAccount = {
    id: row.id,
    currency: row.currency,
    businessLine: row.businessLine,
    bankName: row.bankName.trim(),
    accountName: row.accountName.trim(),
    accountNumber: row.accountNumber.trim(),
  };
  if (row.swiftBic?.trim()) pub.swiftBic = row.swiftBic.trim();
  if (row.iban?.trim()) pub.iban = row.iban.trim();
  if (row.sortCode?.trim()) pub.sortCode = row.sortCode.trim();
  if (row.routingNumber?.trim()) pub.routingNumber = row.routingNumber.trim();
  if (row.intermediaryBank?.trim()) pub.intermediaryBank = row.intermediaryBank.trim();
  if (row.instructions?.trim()) pub.instructions = row.instructions.trim();
  if (row.feeBearer) pub.feeBearer = row.feeBearer;
  if (row.feeTolerance != null && row.feeTolerance > 0) pub.feeTolerance = row.feeTolerance;
  return pub;
}

/**
 * Single resolver for every money path. Returns null when no row exists.
 * Pass `activeOnly: false` for admin matching of a pending transfer after retire.
 */
export async function resolveBankAccount(
  currency: string,
  businessLine: BusinessLineCode,
  opts?: { activeOnly?: boolean },
): Promise<ResolvedBankAccount | null> {
  const cur = parseBankAccountCurrency(currency);
  if (!cur) return null;
  const row = await prisma.bankAccount.findUnique({
    where: { currency_businessLine: { currency: cur as BankAccountCurrency, businessLine: businessLine as BusinessLine } },
  });
  if (!row) return null;
  if ((opts?.activeOnly ?? true) && !row.isActive) return null;
  return toResolved(row);
}

export async function resolvePublicBankAccount(
  currency: string,
  businessLine: BusinessLineCode,
): Promise<PublicBankAccount | null> {
  const row = await resolveBankAccount(currency, businessLine);
  return row ? toPublicBankAccount(row) : null;
}

export async function bankTransferAvailable(
  currency: string,
  businessLine: BusinessLineCode,
): Promise<boolean> {
  const pub = await resolvePublicBankAccount(currency, businessLine);
  return pub != null;
}

export function feeShortfallWithinTolerance(
  expected: number,
  arrived: number,
  tolerance: number | null | undefined,
): boolean {
  if (!Number.isFinite(expected) || !Number.isFinite(arrived)) return false;
  if (arrived >= expected - 0.009) return true;
  const tol = tolerance != null && Number.isFinite(tolerance) ? Math.max(0, tolerance) : 0;
  return expected - arrived <= tol + 0.009;
}

export function feeBearerLabel(bearer: WireFeeBearerCode | undefined): string | null {
  if (bearer === "CUSTOMER") {
    return "You bear sending-bank and intermediary fees. Send the full amount so the sum that arrives matches the invoice.";
  }
  if (bearer === "HOUSE") {
    return "We absorb ordinary sending-bank and intermediary fees on this account.";
  }
  if (bearer === "SHARED") {
    return "Ordinary intermediary fees are shared. Send the invoiced amount; we will match what arrives against the tolerance below.";
  }
  return null;
}

export function feeToleranceLabel(
  currency: BankAccountCurrencyCode,
  tolerance: number | undefined,
): string | null {
  if (tolerance == null || tolerance <= 0) {
    if (currency === "NGN") return null;
    return "The amount that arrives must match the invoice. A shortfall from wire fees leaves a balance owing, and we cannot ship until it is settled.";
  }
  const formatted =
    currency === "NGN"
      ? `₦${tolerance.toLocaleString("en-NG")}`
      : currency === "USD"
        ? `$${tolerance.toLocaleString("en-US")}`
        : currency === "GBP"
          ? `£${tolerance.toLocaleString("en-GB")}`
          : `€${tolerance.toLocaleString("en-IE")}`;
  return `A shortfall of up to ${formatted} from sending-bank or intermediary fees still counts as paid. Anything larger leaves a balance owing.`;
}

export function toFeeBearerEnum(v: string | null | undefined): WireFeeBearer | null {
  if (!v) return null;
  const u = v.trim().toUpperCase();
  if (u === "CUSTOMER" || u === "HOUSE" || u === "SHARED") return u;
  return null;
}
