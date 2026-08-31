import { prisma } from "@/lib/prisma";
import { BankAccountsAdminClient } from "@/components/admin/BankAccountsAdminClient";
import {
  BANK_ACCOUNT_CURRENCIES,
  BUSINESS_LINES,
  type BankAccountCurrencyCode,
  type BusinessLineCode,
} from "@/lib/payments/bank-account";

export default async function AdminBankAccountsPage() {
  const accounts = await prisma.bankAccount.findMany({
    orderBy: [{ businessLine: "asc" }, { currency: "asc" }],
  });
  const slots = BANK_ACCOUNT_CURRENCIES.flatMap((currency) =>
    BUSINESS_LINES.map((businessLine) => ({
      currency: currency as BankAccountCurrencyCode,
      businessLine: businessLine as BusinessLineCode,
      account: accounts.find((a) => a.currency === currency && a.businessLine === businessLine) ?? null,
    })),
  );
  return <BankAccountsAdminClient initialSlots={slots} />;
}
