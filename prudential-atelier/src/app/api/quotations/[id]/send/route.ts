import { NextRequest, NextResponse } from "next/server";
import { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES, requireRoles } from "@/lib/api-auth";
import { getPublicAppUrl } from "@/lib/app-url";
import { logActivity, logError } from "@/lib/logger";
import { sendSmtpMail } from "@/lib/email-transport";
type Params = { params: Promise<{ id: string }> };

type QuoteLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildQuoteEmailHtml(params: {
  clientName: string;
  quoteRef: string;
  total: number;
  approvalUrl: string;
  lineItems: QuoteLineItem[];
  notes: string | null;
}): string {
  const rows = params.lineItems
    .map(
      (item) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #D4BBAC">${item.description}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #D4BBAC;text-align:center">${item.quantity}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #D4BBAC;text-align:right">${formatCurrency(item.unitPrice)}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #D4BBAC;text-align:right">${formatCurrency(item.total)}</td></tr>`,
    )
    .join("");

  return `
    <div style="font-family:Georgia,serif;background:#F7F2EC;padding:24px;color:#442913">
      <h1 style="color:#442913;margin:0 0 8px">Prudential Atelier</h1>
      <hr style="border:none;border-top:2px solid #98755B;margin:16px 0" />
      <p>Dear ${params.clientName},</p>
      <p>Your quotation <strong>${params.quoteRef}</strong> is ready for review.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#E2D1C2">
            <th style="padding:8px;text-align:left">Description</th>
            <th style="padding:8px">Qty</th>
            <th style="padding:8px;text-align:right">Unit</th>
            <th style="padding:8px;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:18px"><strong>Total: ${formatCurrency(params.total)}</strong></p>
      ${params.notes ? `<p>${params.notes}</p>` : ""}
      <p><a href="${params.approvalUrl}" style="display:inline-block;background:#5C3422;color:#F7F2EC;padding:12px 24px;text-decoration:none;border-radius:4px">Review &amp; Approve Quote</a></p>
      <p style="margin-top:32px;font-size:12px;color:#98755B">Prudential Atelier · prudentgabriel.com</p>
    </div>
  `;
}

export async function POST(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(FINANCE_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const quote = await prisma.quotation.findUnique({ where: { id } });
    if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const base = getPublicAppUrl().replace(/\/+$/, "");
    const approvalUrl = `${base}/quote/${quote.approvalToken}`;
    const lineItems = quote.lineItems as QuoteLineItem[];

    await sendSmtpMail({
      to: quote.clientEmail,
      subject: `Your quote is ready — ${quote.quoteRef}`,
      html: buildQuoteEmailHtml({
        clientName: quote.clientName,
        quoteRef: quote.quoteRef,
        total: quote.total,
        approvalUrl,
        lineItems: Array.isArray(lineItems) ? lineItems : [],
        notes: quote.notes,
      }),
    });

    const item = await prisma.quotation.update({
      where: { id },
      data: {
        status: QuoteStatus.SENT,
        sentAt: new Date(),
        pdfUrl: approvalUrl,
      },
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "QUOTE_SEND",
      module: "quotations",
      description: `Sent quotation ${quote.quoteRef} to ${quote.clientEmail}`,
      recordId: quote.id,
      recordType: "Quotation",
    });

    return NextResponse.json({ item, approvalUrl });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_SEND",
      message: e instanceof Error ? e.message : "Failed to send quotation",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
