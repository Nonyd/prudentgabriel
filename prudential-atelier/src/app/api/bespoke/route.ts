import { NextRequest, NextResponse } from "next/server";
import { BespokeStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { commissionSearch } from "@/lib/atelier/commission-search";
import { commissionListSelect, commissionRow, fabricPendingWhere } from "@/lib/atelier/commission-list";
import { logActivity } from "@/lib/logger";
import { bespokeFacts, requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { generateBespokeOrderRef } from "@/lib/bespoke-stages";
import { newOrderSteps } from "@/lib/atelier/pipeline-db";
import { bespokeRequestSchema } from "@/validations/bespoke";
import { auth } from "@/auth";
import { generateBespokeNumber } from "@/lib/order-number";
import { sendBespokeConfirmationEmail, sendAdminNotificationEmail } from "@/lib/email";
import { notifyNewBespoke } from "@/lib/notifications";
import { CAPABILITY_TTL_MS, generateCapabilityToken } from "@/lib/capability-token";
import { rateLimitOr429 } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // The whole list is the pipeline page's: the `bespoke` key. STAFF use the staff portal.
  const gate = await requireBespokeAccess("read");
  if (!gate.ok) return gate.response;

  const query = commissionSearch(new URL(req.url).searchParams);
  if (!query.ok) return NextResponse.json({ error: query.error }, { status: 400 });

  const [items, fabricPending] = await Promise.all([
    prisma.bespokeOrder.findMany({
      where: query.where,
      orderBy: query.orderBy,
      take: 200,
      select: commissionListSelect,
    }),
    prisma.bespokeOrder.count({ where: fabricPendingWhere() }),
  ]);

  // BD1/BD4: rows carry no email, receipt, total, paid or balance — whoever holds the key.
  return NextResponse.json({ items: items.map(commissionRow), counts: { fabricPending } });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // Whoever holds the pipeline's key creates commissions here; everyone else is the public form.
  const isAdmin = session?.user?.id ? (await bespokeFacts(session)).facts.house : false;
  if (!isAdmin) {
    const limited = await rateLimitOr429(req, "bespoke-request", 5, 60 * 60 * 1000);
    if (limited) return limited;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (isAdmin && body && typeof body === "object" && "clientName" in body) {
    const gate = await requireBespokeAccess("manage");
    if (!gate.ok) return gate.response;

    const d = body as {
      clientName: string;
      clientEmail: string;
      clientPhone?: string;
      outfitDescription?: string;
      occasionType?: string;
      eventLocation?: string;
      clientLocation?: string;
      deliveryDate?: string;
      notes?: string;
      totalAmount?: number;
      clientProfileId?: string;
    };

    if (!d.clientName?.trim() || !d.clientEmail?.trim()) {
      return NextResponse.json({ error: "Client name and email are required" }, { status: 400 });
    }

    let orderRef = generateBespokeOrderRef();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.bespokeOrder.findUnique({ where: { orderRef } });
      if (!exists) break;
      orderRef = generateBespokeOrderRef();
    }

    const total = d.totalAmount ?? 0;
    if (total !== 0 && !gate.facts.money) {
      return NextResponse.json({ error: "Setting a price is kept for managers and finance." }, { status: 403 });
    }
    const track = generateCapabilityToken();
    const receipt = generateCapabilityToken();
    const created = await prisma.bespokeOrder.create({
      data: {
        orderRef,
        clientProfileId: d.clientProfileId || null,
        clientName: d.clientName.trim(),
        clientEmail: d.clientEmail.trim().toLowerCase(),
        clientPhone: d.clientPhone?.trim() || null,
        outfitDescription: d.outfitDescription || null,
        occasionType: d.occasionType || null,
        eventLocation: d.eventLocation || null,
        clientLocation: d.clientLocation || null,
        deliveryDate: d.deliveryDate ? new Date(d.deliveryDate) : null,
        notes: d.notes || null,
        totalAmount: total,
        balance: total,
        trackingToken: track.hash,
        trackingTokenEnc: track.enc,
        trackingTokenExpiresAt: new Date(Date.now() + CAPABILITY_TTL_MS.track),
        receiptConfirmToken: receipt.hash,
        receiptConfirmTokenEnc: receipt.enc,
        // The thirteen built-in steps, Consultation Booking under way.
        steps: { create: newOrderSteps(BespokeStage.CONSULTATION_BOOKING) },
      },
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "ORDER_CREATE",
      module: "bespoke",
      description: `Created bespoke order ${orderRef}`,
      recordId: created.id,
      recordType: "BespokeOrder",
    });

    return NextResponse.json({ item: created }, { status: 201 });
  }

  const parsed = bespokeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const requestNumber = generateBespokeNumber();

  const created = await prisma.bespokeRequest.create({
    data: {
      requestNumber,
      userId: session?.user?.id ?? null,
      name: d.name,
      email: d.email,
      phone: d.phone,
      country: d.country,
      source: d.source,
      occasion: d.occasion,
      description: d.description,
      budgetRange: d.budgetRange,
      timeline: d.timeline,
      measurements: d.measurements ? (d.measurements as object) : undefined,
      referenceImages: d.referenceImages ?? [],
      preferredDate: d.preferredDate ?? null,
      entrySource: "WEBSITE",
    },
  });

  void notifyNewBespoke(created);
  void sendBespokeConfirmationEmail(
    d.email,
    d.name,
    requestNumber,
    d.occasion,
    d.timeline ?? d.budgetRange ?? "—",
  );
  void sendAdminNotificationEmail(
    `New bespoke request ${requestNumber}`,
    // Visitor text: escaped, since admins preview this mail in the outbox.
    `<p>${escapeHtml(d.name)} — ${escapeHtml(d.email)}</p><p>${escapeHtml(d.description)}</p>`,
    undefined,
    "atelier",
  );

  return NextResponse.json({ success: true, requestNumber });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
