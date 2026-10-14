import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";
import { sendQuoteChangeReplyEmail } from "@/lib/email";
import { ensureQuoteApprovalRaw } from "@/lib/capability-token-lookup";
import { QuoteStatus } from "@prisma/client";
import { getPublicAppUrl } from "@/lib/app-url";

type Params = { params: Promise<{ id: string; requestId: string }> };

const bodySchema = z.object({ response: z.string().trim().min(2).max(4000) });

/**
 * The house answers a client's change request. The reply is recorded once,
 * shown on her quote page and emailed to her with a link to the latest version.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi("quotations");
  if (!gate.ok) return gate.response;
  const { requestId } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Write a reply first." }, { status: 400 });

  try {
    const request = await prisma.quotationChangeRequest.findUnique({
      where: { id: requestId },
      include: { quotation: true },
    });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const user = gate.session.user;
    const respondedBy = user.name?.trim() || user.email || user.id;
    // Answer once: two people replying at the same time cannot both send.
    const updated = await prisma.quotationChangeRequest.updateMany({
      where: { id: requestId, response: null },
      data: { response: parsed.data.response, respondedAt: new Date(), respondedBy },
    });
    if (updated.count !== 1) {
      return NextResponse.json({ error: "This request has already been answered." }, { status: 409 });
    }

    // Link her to the version she should act on now: a sent revision, never an unsent draft.
    const latestSent = await prisma.quotation.findFirst({
      where: {
        baseQuoteRef: request.quotation.baseQuoteRef,
        status: { notIn: [QuoteStatus.SUPERSEDED, QuoteStatus.DRAFT] },
      },
      orderBy: { version: "desc" },
    });
    const latest = latestSent ?? request.quotation;
    const rawToken = await ensureQuoteApprovalRaw(latest);
    await sendQuoteChangeReplyEmail({
      to: request.quotation.clientEmail,
      clientName: request.quotation.clientName,
      quoteRef: latest.quoteRef,
      request: request.message,
      response: parsed.data.response,
      quoteUrl: `${getPublicAppUrl().replace(/\/+$/, "")}/quote/${rawToken}`,
      requestId,
    });

    void logActivity({
      userId: user.id,
      userEmail: user.email ?? undefined,
      userRole: user.role,
      action: "UPDATE",
      module: "quotations",
      description: `Replied to a change request on ${request.quotation.quoteRef}`,
      recordId: request.quotationId,
      recordType: "Quotation",
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_CHANGE_REPLY",
      message: e instanceof Error ? e.message : "Failed to reply",
    });
    return NextResponse.json({ error: "Could not send the reply" }, { status: 500 });
  }
}
