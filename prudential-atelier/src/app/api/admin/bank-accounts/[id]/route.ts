import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { WIRE_FEE_BEARERS, isUsableBankAccount } from "@/lib/payments/bank-account";

const patchSchema = z.object({
  accountName: z.string().trim().min(2).max(120).optional(),
  accountNumber: z.string().trim().min(4).max(64).optional(),
  bankName: z.string().trim().min(2).max(120).optional(),
  swiftBic: z.string().trim().max(20).optional().nullable(),
  iban: z.string().trim().max(42).optional().nullable(),
  sortCode: z.string().trim().max(20).optional().nullable(),
  routingNumber: z.string().trim().max(20).optional().nullable(),
  intermediaryBank: z.string().trim().max(2000).optional().nullable(),
  instructions: z.string().trim().max(4000).optional().nullable(),
  feeBearer: z.enum(WIRE_FEE_BEARERS).optional().nullable(),
  feeTolerance: z.number().min(0).max(1_000_000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi(["settings", "settings.bank-accounts"]);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const next = {
    accountName: parsed.data.accountName ?? existing.accountName,
    accountNumber: parsed.data.accountNumber ?? existing.accountNumber,
    bankName: parsed.data.bankName ?? existing.bankName,
    isActive: parsed.data.isActive ?? existing.isActive,
  };
  if (next.isActive && !isUsableBankAccount(next)) {
    return NextResponse.json({ error: "Account name, number, and bank are required to activate" }, { status: 400 });
  }

  const row = await prisma.bankAccount.update({
    where: { id },
    data: {
      ...parsed.data,
      swiftBic: parsed.data.swiftBic === undefined ? undefined : parsed.data.swiftBic || null,
      iban: parsed.data.iban === undefined ? undefined : parsed.data.iban || null,
      sortCode: parsed.data.sortCode === undefined ? undefined : parsed.data.sortCode || null,
      routingNumber: parsed.data.routingNumber === undefined ? undefined : parsed.data.routingNumber || null,
      intermediaryBank:
        parsed.data.intermediaryBank === undefined ? undefined : parsed.data.intermediaryBank || null,
      instructions: parsed.data.instructions === undefined ? undefined : parsed.data.instructions || null,
      feeBearer: parsed.data.feeBearer === undefined ? undefined : parsed.data.feeBearer,
      feeTolerance: parsed.data.feeTolerance === undefined ? undefined : parsed.data.feeTolerance,
    },
  });
  return NextResponse.json(row);
}
