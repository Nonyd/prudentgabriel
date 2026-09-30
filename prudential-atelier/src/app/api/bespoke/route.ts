import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { commissionSearch } from "@/lib/atelier/commission-search";
import { specificationInclude } from "@/lib/atelier/construction-features";
import { canSeePaymentDetails, stripOrderReceipt } from "@/lib/bespoke-data-access";
import { logActivity } from "@/lib/logger";
import { BESPOKE_MANAGER_ROLES, BESPOKE_STAFF_ROLES, requireRoles } from "@/lib/api-auth";
import { generateBespokeOrderRef } from "@/lib/bespoke-stages";
import { bespokeRequestSchema } from "@/validations/bespoke";
import { auth } from "@/auth";
import { generateBespokeNumber } from "@/lib/order-number";
import { sendBespokeConfirmationEmail, sendAdminNotificationEmail } from "@/lib/email";
import { notifyNewBespoke } from "@/lib/notifications";
import { CAPABILITY_TTL_MS, generateCapabilityToken } from "@/lib/capability-token";

export async function GET(req: NextRequest) {
  const gate = await requireRoles(BESPOKE_STAFF_ROLES);
  if (!gate.ok) return gate.response;

  const query = commissionSearch(new URL(req.url).searchParams);
  if (!query.ok) return NextResponse.json({ error: query.error }, { status: 400 });

  const items = await prisma.bespokeOrder.findMany({
    where: query.where,
    orderBy: query.orderBy,
    take: 200,
    include: {
      stageHistory: { orderBy: { completedAt: "desc" }, take: 1 },
      assignments: { include: { staffProfile: { include: { user: { select: { name: true } } } } } },
      stageApprovals: {
        where: { status: "PENDING" },
        select: { id: true, stage: true, status: true },
      },
      ...specificationInclude,
    },
  });

  // Slice AZ8: the order row carries the last transfer receipt and its reference.
  const seePayments = canSeePaymentDetails(gate.session.user);
  return NextResponse.json({ items: seePayments ? items : items.map(stripOrderReceipt) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const isAdmin =
    session?.user?.role &&
    (BESPOKE_MANAGER_ROLES.includes(session.user.role) || session.user.role === "SUPER_ADMIN");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (isAdmin && body && typeof body === "object" && "clientName" in body) {
    const gate = await requireRoles(BESPOKE_MANAGER_ROLES);
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
    `<p>${d.name} — ${d.email}</p><p>${d.description}</p>`,
  );

  return NextResponse.json({ success: true, requestNumber });
}
