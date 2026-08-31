/**
 * Slice P: bank accounts by currency and business line.
 *
 *   pnpm test:slice-p
 */
import "./preload-test-env";
import { BankAccountCurrency, BusinessLine, type BankAccount } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getSupportedGateways } from "../src/lib/payments/config";
import {
  feeShortfallWithinTolerance,
  resolveBankAccount,
  resolvePublicBankAccount,
} from "../src/lib/payments/bank-account";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `p-${Date.now()}`;
const createdIds: string[] = [];
const restore: BankAccount[] = [];

async function upsertAccount(params: {
  currency: BankAccountCurrency;
  businessLine: BusinessLine;
  accountNumber: string;
  isActive?: boolean;
  swiftBic?: string | null;
  sortCode?: string | null;
}) {
  const existing = await prisma.bankAccount.findUnique({
    where: { currency_businessLine: { currency: params.currency, businessLine: params.businessLine } },
  });
  if (existing) restore.push(existing);
  const row = await prisma.bankAccount.upsert({
    where: {
      currency_businessLine: { currency: params.currency, businessLine: params.businessLine },
    },
    create: {
      currency: params.currency,
      businessLine: params.businessLine,
      accountName: `Slice P ${params.currency} ${params.businessLine} ${stamp}`,
      accountNumber: params.accountNumber,
      bankName: "Test Bank",
      swiftBic: params.swiftBic ?? null,
      sortCode: params.sortCode ?? null,
      isActive: params.isActive ?? true,
    },
    update: {
      accountName: `Slice P ${params.currency} ${params.businessLine} ${stamp}`,
      accountNumber: params.accountNumber,
      bankName: "Test Bank",
      swiftBic: params.swiftBic ?? null,
      sortCode: params.sortCode ?? null,
      isActive: params.isActive ?? true,
    },
  });
  if (!existing) createdIds.push(row.id);
  return row;
}

async function main() {
  assert(feeShortfallWithinTolerance(1000, 1000, 25), "exact arrival settles");
  assert(feeShortfallWithinTolerance(1000, 980, 25), "within tolerance settles");
  assert(!feeShortfallWithinTolerance(1000, 900, 25), "beyond tolerance does not settle");
  assert(feeShortfallWithinTolerance(1000, 990, 0) === false, "zero tolerance rejects a shortfall");
  assert(feeShortfallWithinTolerance(1000, 1005, 0), "overpayment settles");

  const gbpRtw = await upsertAccount({
    currency: "GBP",
    businessLine: "RTW",
    accountNumber: `GB00P${stamp.slice(-8)}`,
    swiftBic: "NWBKGB2L",
    sortCode: "60-16-13",
  });
  const gbpGateways = await getSupportedGateways("GBP", "RTW");
  assert(gbpGateways.includes("BANK_TRANSFER"), "GBP RTW cart offers bank transfer when the account is active");
  const gbpPublic = await resolvePublicBankAccount("GBP", "RTW");
  assert(gbpPublic?.id === gbpRtw.id, "GBP cart resolves the GBP RTW account");
  assert(gbpPublic?.accountNumber === gbpRtw.accountNumber, "GBP RTW account number is the one shown");
  assert(gbpPublic?.swiftBic === "NWBKGB2L", "SWIFT is shown when populated");

  const ngnAtelier = await upsertAccount({
    currency: "NGN",
    businessLine: "ATELIER",
    accountNumber: `NGN${stamp.slice(-8)}01`,
  });
  const consult = await resolvePublicBankAccount("NGN", "ATELIER");
  assert(consult?.id === ngnAtelier.id, "consultation resolves the NGN Atelier account");
  const consultGateways = await getSupportedGateways("NGN", "ATELIER");
  assert(consultGateways.includes("BANK_TRANSFER"), "consultation offers bank transfer for NGN Atelier");

  await upsertAccount({
    currency: "GBP",
    businessLine: "ATELIER",
    accountNumber: `GBAT${stamp.slice(-8)}`,
    isActive: false,
  });
  const hidden = await getSupportedGateways("GBP", "ATELIER");
  assert(
    !hidden.includes("BANK_TRANSFER"),
    "a currency/line with no active account hides bank transfer entirely",
  );

  const usdRtw = await upsertAccount({
    currency: "USD",
    businessLine: "RTW",
    accountNumber: `USD${stamp.slice(-8)}`,
  });
  const originalOrderCurrency = "USD";
  const checkoutAccount = await resolveBankAccount(originalOrderCurrency, "RTW");
  const topUpAccount = await resolveBankAccount(originalOrderCurrency, "RTW");
  assert(checkoutAccount?.id === usdRtw.id, "RTW checkout uses the USD RTW account");
  assert(
    topUpAccount?.id === checkoutAccount?.id,
    "shipping top-up resolves to the same account as the original order",
  );

  console.log("slice-p: all assertions passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (createdIds.length) {
      await prisma.bankAccount.deleteMany({ where: { id: { in: createdIds } } }).catch(() => undefined);
    }
    for (const prev of restore) {
      await prisma.bankAccount
        .update({
          where: { id: prev.id },
          data: {
            accountName: prev.accountName,
            accountNumber: prev.accountNumber,
            bankName: prev.bankName,
            swiftBic: prev.swiftBic,
            iban: prev.iban,
            sortCode: prev.sortCode,
            routingNumber: prev.routingNumber,
            intermediaryBank: prev.intermediaryBank,
            instructions: prev.instructions,
            feeBearer: prev.feeBearer,
            feeTolerance: prev.feeTolerance,
            isActive: prev.isActive,
          },
        })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });
