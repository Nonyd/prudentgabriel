import { NextRequest, NextResponse } from "next/server";
import { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";
import { sendSmtpMail, ORDERS_EMAIL } from "@/lib/email-transport";
import { notifyQuoteApproved } from "@/lib/notifications";
import { maybeAutoConvertApprovedQuote } from "@/lib/quotation-convert";
import { findLatestQuotationVersion } from "@/lib/quotation-versioning";
import { getPublicAppUrl } from "@/lib/app-url";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: { approvalToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const approvalToken = body.approvalToken?.trim();
  if (!approvalToken) {
    return NextResponse.json({ error: "approvalToken is required" }, { status: 400 });
  }

  try {
    const quote = await prisma.quotation.findFirst({
      where: { id, approvalToken },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    if (quote.status === QuoteStatus.SUPERSEDED) {
      const latest = await findLatestQuotationVersion(quote.baseQuoteRef);
      const base = getPublicAppUrl().replace(/\/+$/, "");
      return NextResponse.json(
        {
          error: "This quotation has been superseded by a newer version.",
          superseded: true,
          latestQuoteRef: latest?.quoteRef ?? null,
          latestApprovalUrl: latest ? `${base}/quote/${latest.approvalToken}` : null,
        },
        { status: 409 },
      );
    }

    if (quote.status === QuoteStatus.APPROVED || quote.status === QuoteStatus.CONVERTED) {
      return NextResponse.json({ error: "Quotation already approved" }, { status: 400 });
    }

    if (quote.expiresAt && quote.expiresAt < new Date()) {
      return NextResponse.json({ error: "Quotation has expired" }, { status: 400 });
    }

    const item = await prisma.quotation.update({
      where: { id: quote.id },
      data: {
        status: QuoteStatus.APPROVED,
        approvedAt: new Date(),
      },
    });

    await logActivity({
      action: "UPDATE",
      module: "quotations",
      description: `Client approved quotation ${quote.quoteRef}`,
      recordId: quote.id,
      recordType: "Quotation",
      userEmail: quote.clientEmail,
    });

    void sendSmtpMail({
      to: ORDERS_EMAIL,
      subject: `Quote approved — ${quote.quoteRef}`,
      html: `<p>${quote.clientName} (${quote.clientEmail}) approved quotation ${quote.quoteRef}.</p>`,
    }).catch(() => undefined);

    notifyQuoteApproved(quote);
    void maybeAutoConvertApprovedQuote(quote.id);

    return NextResponse.json({ item, message: "Quotation approved" });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_APPROVE",
      message: e instanceof Error ? e.message : "Failed to approve quotation",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
