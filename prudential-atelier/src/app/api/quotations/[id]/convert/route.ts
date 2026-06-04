import { NextRequest, NextResponse } from "next/server";
import { QuoteStatus } from "@prisma/client";
import { FINANCE_ROLES, requireRoles } from "@/lib/api-auth";
import { logActivity, logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { convertQuotationToOrder } from "@/lib/quotation-convert";

type Params = { params: Promise<{ id: string }> };

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

    const result = await convertQuotationToOrder(quote, gate.session.user.id);

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "ORDER_CREATE",
      module: "quotations",
      description: `Converted quotation ${quote.quoteRef} to bespoke order ${result.orderRef}`,
      recordId: result.orderId,
      recordType: "BespokeOrder",
    });

    return NextResponse.json(
      {
        order: { id: result.orderId, orderRef: result.orderRef },
        invoice: { id: result.invoiceId, invoiceNumber: result.invoiceNumber },
        quotationId: quote.id,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_CONVERTED") {
      const existing = await prisma.bespokeOrder.findFirst({ where: { quotationId: id } });
      return NextResponse.json(
        { error: "Quotation already converted", order: existing },
        { status: 409 },
      );
    }
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_CONVERT",
      message: e instanceof Error ? e.message : "Failed to convert quotation",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
