import { NextRequest, NextResponse } from "next/server";
import { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES, requireRoles } from "@/lib/api-auth";
import { generateBespokeOrderRef } from "@/lib/bespoke-stages";
import { logActivity, logError } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

async function uniqueOrderRef(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const orderRef = generateBespokeOrderRef();
    const exists = await prisma.bespokeOrder.findUnique({ where: { orderRef } });
    if (!exists) return orderRef;
  }
  return generateBespokeOrderRef();
}

export async function POST(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(FINANCE_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const quote = await prisma.quotation.findUnique({ where: { id } });
    if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (quote.status !== QuoteStatus.APPROVED && quote.status !== QuoteStatus.SENT) {
      return NextResponse.json(
        { error: "Only sent or approved quotations can be converted" },
        { status: 400 },
      );
    }

    const existingOrder = await prisma.bespokeOrder.findFirst({
      where: { quotationId: quote.id },
    });
    if (existingOrder) {
      return NextResponse.json(
        { error: "Quotation already converted", order: existingOrder },
        { status: 409 },
      );
    }

    const clientProfile = await prisma.clientProfile.findFirst({
      where: { user: { email: quote.clientEmail } },
    });

    const orderRef = await uniqueOrderRef();
    const total = quote.total;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.bespokeOrder.create({
        data: {
          orderRef,
          quotationId: quote.id,
          clientProfileId: clientProfile?.id ?? null,
          clientName: quote.clientName,
          clientEmail: quote.clientEmail,
          clientPhone: quote.clientPhone,
          totalAmount: total,
          balance: total,
          notes: quote.notes,
        },
      });

      await tx.quotation.update({
        where: { id: quote.id },
        data: { status: QuoteStatus.CONVERTED },
      });

      return created;
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "ORDER_CREATE",
      module: "quotations",
      description: `Converted quotation ${quote.quoteRef} to bespoke order ${orderRef}`,
      recordId: order.id,
      recordType: "BespokeOrder",
    });

    return NextResponse.json({ order, quotationId: quote.id }, { status: 201 });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_CONVERT",
      message: e instanceof Error ? e.message : "Failed to convert quotation",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
