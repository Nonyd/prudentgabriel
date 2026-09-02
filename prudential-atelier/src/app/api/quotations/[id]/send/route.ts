import { NextRequest, NextResponse } from "next/server";
import { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { getPublicAppUrl } from "@/lib/app-url";
import { logActivity, logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { notifyQuoteReady } from "@/lib/customer-notifications";

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
  pdfUrl?: string;
  lineItems: QuoteLineItem[];
  notes: string | null;
  consultationSection?: string;
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
      <h1 style="color:#442913;margin:0 0 8px">${CUSTOMER_HOUSE_NAME}</h1>
      <hr style="border:none;border-top:2px solid #98755B;margin:16px 0" />
      <p>Dear ${params.clientName},</p>
      <p>Your quotation <strong>${params.quoteRef}</strong> is ready for review.</p>
      ${params.consultationSection ?? ""}
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
      ${
        params.pdfUrl
          ? `<p style="margin-top:16px;font-size:13px"><a href="${params.pdfUrl}" style="color:#5C3422">Download PDF quotation</a> (for your records)</p>`
          : ""
      }
      <p style="margin-top:32px;font-size:12px;color:#98755B">${CUSTOMER_HOUSE_NAME} · prudentgabriel.com</p>
    </div>
  `;
}

export async function POST(_req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi("quotations");
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const quote = await prisma.quotation.findUnique({
      where: { id },
      include: {
        consultation: {
          select: {
            sessionNotes: true,
            confirmedDate: true,
            completedAt: true,
            offeringType: true,
            offering: { select: { sessionType: true } },
          },
        },
      },
    });
    if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (quote.status === QuoteStatus.SUPERSEDED) {
      return NextResponse.json({ error: "Cannot send a superseded quotation" }, { status: 400 });
    }
    if (quote.status === QuoteStatus.CONVERTED) {
      return NextResponse.json({ error: "Converted quotations cannot be sent" }, { status: 400 });
    }

    const base = getPublicAppUrl().replace(/\/+$/, "");
    const approvalUrl = `${base}/quote/${quote.approvalToken}`;
    const pdfPublicUrl = `${base}/api/quote/${quote.approvalToken}/pdf`;
    const lineItems = quote.lineItems as QuoteLineItem[];

    let consultationSection = "";
    if (quote.consultation) {
      const c = quote.consultation;
      const sessionDate = c.completedAt ?? c.confirmedDate;
      const dateLabel = sessionDate
        ? sessionDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "your recent session";
      const sessionType =
        c.offeringType?.replace(/_/g, " ") ??
        c.offering.sessionType.replace(/_/g, " ").toLowerCase();
      const excerpt = (c.sessionNotes ?? "").slice(0, 200);
      consultationSection = `
        <div style="margin:20px 0;padding:16px;background:rgba(152,117,91,0.08);border:1px solid #D4BBAC;border-radius:6px">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#98755B">Based on your consultation</p>
          <p style="margin:0 0 12px">We've prepared this quotation based on your ${sessionType} on ${dateLabel}.</p>
          ${excerpt ? `<p style="margin:0"><strong>Your outfit brief:</strong><br/>&ldquo;${excerpt}${(c.sessionNotes?.length ?? 0) > 200 ? "…" : ""}&rdquo;</p>` : ""}
        </div>
      `;
    }

    // Queue the rendered HTML; transport is out of band. Quote is marked SENT
    // once the outbox row exists so a failed SMTP attempt is still visible.
    const html = buildQuoteEmailHtml({
      clientName: quote.clientName,
      quoteRef: quote.quoteRef,
      total: quote.total,
      approvalUrl,
      pdfUrl: pdfPublicUrl,
      lineItems: Array.isArray(lineItems) ? lineItems : [],
      notes: quote.notes,
      consultationSection,
    });
    await sendEmail({
      to: quote.clientEmail,
      subject: `Your quote is ready — ${quote.quoteRef}`,
      html,
      template: "quote-sent",
      idempotencyKey: `quote-sent:${quote.id}:v${quote.version}`,
      relatedType: "Quotation",
      relatedId: quote.id,
    });

    const item = await prisma.quotation.update({
      where: { id },
      data: {
        status: QuoteStatus.SENT,
        sentAt: new Date(),
        approvalUrl,
        pdfUrl: pdfPublicUrl,
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

    notifyQuoteReady({
      clientEmail: quote.clientEmail,
      quoteId: quote.id,
      quoteRef: quote.quoteRef,
      approvalToken: quote.approvalToken,
    });

    return NextResponse.json({ item, approvalUrl, pdfUrl: pdfPublicUrl });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_SEND",
      message: e instanceof Error ? e.message : "Failed to send quotation",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
