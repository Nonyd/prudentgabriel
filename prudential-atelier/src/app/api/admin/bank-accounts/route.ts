import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  BANK_ACCOUNT_CURRENCIES,
  BUSINESS_LINES,
  WIRE_FEE_BEARERS,
  isUsableBankAccount,
} from "@/lib/payments/bank-account";

const createSchema = z.object({
  currency: z.enum(BANK_ACCOUNT_CURRENCIES),
  businessLine: z.enum(BUSINESS_LINES),
  accountName: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().min(4).max(64),
  bankName: z.string().trim().min(2).max(120),
  swiftBic: z.string().trim().max(20).optional().nullable(),
  iban: z.string().trim().max(42).optional().nullable(),
  sortCode: z.string().trim().max(20).optional().nullable(),
  routingNumber: z.string().trim().max(20).optional().nullable(),
  intermediaryBank: z.string().trim().max(2000).optional().nullable(),
  instructions: z.string().trim().max(4000).optional().nullable(),
  feeBearer: z.enum(WIRE_FEE_BEARERS).optional().nullable(),
  feeTolerance: z.number().min(0).max(1_000_000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export async function GET() {
  const gate = await requireAdminApi(["settings", "settings.bank-accounts"]);
  if (!gate.ok) return gate.response;
  const accounts = await prisma.bankAccount.findMany({
    orderBy: [{ businessLine: "asc" }, { currency: "asc" }],
  });
  return NextResponse.json({
    accounts,
    slots: BANK_ACCOUNT_CURRENCIES.flatMap((currency) =>
      BUSINESS_LINES.map((businessLine) => ({
        currency,
        businessLine,
        account: accounts.find((a) => a.currency === currency && a.businessLine === businessLine) ?? null,
      })),
    ),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi(["settings", "settings.bank-accounts"]);
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  if (
    !isUsableBankAccount({
      accountNumber: data.accountNumber,
      bankName: data.bankName,
      accountName: data.accountName,
      isActive: true,
    })
  ) {
    return NextResponse.json({ error: "Account name, number, and bank are required" }, { status: 400 });
  }

  try {
    const row = await prisma.bankAccount.create({
      data: {
        currency: data.currency,
        businessLine: data.businessLine,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        bankName: data.bankName,
        swiftBic: data.swiftBic || null,
        iban: data.iban || null,
        sortCode: data.sortCode || null,
        routingNumber: data.routingNumber || null,
        intermediaryBank: data.intermediaryBank || null,
        instructions: data.instructions || null,
        feeBearer: data.feeBearer ?? null,
        feeTolerance: data.feeTolerance ?? null,
        isActive: data.isActive ?? true,
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    const code = typeof e === "object" && e && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      return NextResponse.json(
        { error: `An account already exists for ${data.currency} ${data.businessLine}` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Could not save account" }, { status: 500 });
  }
}
