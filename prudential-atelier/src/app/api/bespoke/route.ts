import { NextRequest, NextResponse } from "next/server";
import { BespokeStage, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/logger";
import { BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";
import { generateBespokeOrderRef } from "@/lib/bespoke-stages";
import { bespokeRequestSchema } from "@/validations/bespoke";
import { auth } from "@/auth";
import { generateBespokeNumber } from "@/lib/order-number";
import { sendBespokeConfirmationEmail, sendAdminNotificationEmail } from "@/lib/email";
import { notifyNewBespoke } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.BespokeOrderWhereInput = {};
  if (stage && stage !== "all") where.currentStage = stage as BespokeStage;
  if (status && status !== "all") where.status = status as OrderStatus;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (search) {
    where.OR = [
      { orderRef: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
      { clientEmail: { contains: search, mode: "insensitive" } },
    ];
  }

  const items = await prisma.bespokeOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      stageHistory: { orderBy: { completedAt: "desc" }, take: 1 },
      assignments: { include: { staffProfile: { include: { user: { select: { name: true } } } } } },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const isAdmin =
    session?.user?.role &&
    (BESPOKE_ROLES.includes(session.user.role) || session.user.role === "SUPER_ADMIN");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (isAdmin && body && typeof body === "object" && "clientName" in body) {
    const gate = await requireRoles(BESPOKE_ROLES);
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
