import { NextRequest, NextResponse } from "next/server";
import { QuoteStatus } from "@prisma/client";
import { z } from "zod";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";
import { sendAdminNotificationEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { getPublicAppUrl } from "@/lib/app-url";
import { CAPABILITY_EXPIRED_COPY, assertCapabilityNotExpired, capabilityLookupKey } from "@/lib/capability-token";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  approvalToken: z.string().trim().min(1),
  message: z.string().trim().min(3, "Please tell us what you would like changed.").max(2000),
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * The client asks for changes from the quote page (same capability token as
 * approval). Recorded on the quotation for the desk to answer; the desk is
 * notified in the bell and by email. Nothing about the quotation changes.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const limited = await rateLimitOr429(req, "quote-token-request-changes", 6, 15 * 60 * 1000);
  if (limited) return limited;

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check your message." },
      { status: 400 },
    );
  }
  const { approvalToken, message } = parsed.data;

  try {
    const quote = await prisma.quotation.findFirst({
      where: { id, approvalToken: capabilityLookupKey(approvalToken) },
    });
    if (!quote) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    if (assertCapabilityNotExpired(quote.approvalTokenExpiresAt) === "expired") {
      return NextResponse.json({ error: CAPABILITY_EXPIRED_COPY.body }, { status: 410 });
    }
    if (quote.status === QuoteStatus.SUPERSEDED) {
      return NextResponse.json(
        { error: "This quotation has been replaced by a newer version. Please use the latest link we sent." },
        { status: 409 },
      );
    }
    if (quote.status === QuoteStatus.APPROVED || quote.status === QuoteStatus.CONVERTED) {
      return NextResponse.json(
        { error: "This quotation is already approved. Please reply to our email to discuss changes." },
        { status: 409 },
      );
    }

    const request = await prisma.quotationChangeRequest.create({
      data: { quotationId: quote.id, message },
      select: { id: true, message: true, createdAt: true, response: true, respondedAt: true },
    });

    const adminLink = `/admin/quotations/${quote.id}`;
    void createNotification({
      type: "QUOTE_CHANGES_REQUESTED",
      title: "Changes requested on a quote",
      message: `${quote.quoteRef} — ${quote.clientName}: ${message.length > 90 ? `${message.slice(0, 90)}…` : message}`,
      link: adminLink,
      entityId: quote.id,
    }).catch(() => {});

    void sendAdminNotificationEmail(
      `Changes requested — ${quote.quoteRef}`,
      `<p><strong>${escapeHtml(quote.clientName)}</strong> (${escapeHtml(quote.clientEmail)}) asked for changes to quotation <strong>${escapeHtml(quote.quoteRef)}</strong>:</p>
<p style="padding-left:12px;border-left:2px solid #e2d1c2;white-space:pre-line;">${escapeHtml(message)}</p>
<p><a href="${getPublicAppUrl()}${adminLink}">Open the quotation to reply or revise it</a></p>`,
      `quote-changes-requested:${request.id}`,
      "quotations",
    ).catch(() => undefined);

    void logActivity({
      action: "UPDATE",
      module: "quotations",
      description: `Client asked for changes on ${quote.quoteRef}`,
      recordId: quote.id,
      recordType: "Quotation",
      userEmail: quote.clientEmail,
    }).catch(() => {});

    return NextResponse.json({ request });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_REQUEST_CHANGES",
      message: e instanceof Error ? e.message : "Failed to record change request",
    });
    return NextResponse.json({ error: "Could not send your request. Please try again." }, { status: 500 });
  }
}
