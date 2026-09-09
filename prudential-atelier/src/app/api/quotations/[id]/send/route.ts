import { NextRequest, NextResponse } from "next/server";
import { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { getPublicAppUrl } from "@/lib/app-url";
import { logActivity, logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { notifyQuoteReady } from "@/lib/customer-notifications";
import { getLockedFx, persistableFxFields } from "@/lib/fx";
import { lockedDocumentTotal } from "@/lib/atelier-fx";
import { buildQuoteEmailHtml } from "@/lib/quote-email";

type Params = { params: Promise<{ id: string }> };

type QuoteLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

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
      currency: quote.currency || "NGN",
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

    const fx = quote.fxRateLocked ? null : await getLockedFx();
    const lockedTotals = fx ? lockedDocumentTotal(quote.currency || "NGN", quote.total) : null;
    const item = await prisma.quotation.update({
      where: { id },
      data: {
        status: QuoteStatus.SENT,
        sentAt: new Date(),
        approvalUrl,
        pdfUrl: pdfPublicUrl,
        ...(fx
          ? {
              ...persistableFxFields(fx),
              fxUsdAmountLocked: lockedTotals?.fxUsdAmountLocked,
              fxGbpAmountLocked: lockedTotals?.fxGbpAmountLocked,
            }
          : {}),
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
