import { NextRequest, NextResponse } from "next/server";
import { BespokeStage, Role, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { snapshotFrom } from "@/lib/atelier/commission-measurements";
import { placeholderEmail } from "@/lib/atelier/manual-onboarding";
import { isUndeliverableAddress } from "@/lib/email-outbox";
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
      /** A client picked from the suggestions: her account, not her profile. */
      clientUserId?: string;
    };

    if (!d.clientUserId && !d.clientName?.trim()) {
      return NextResponse.json({ error: "Enter the client's name, or pick a client already on file." }, { status: 400 });
    }

    const client = await resolveCommissionClient(d);
    if (!client.ok) return NextResponse.json({ error: client.error }, { status: client.status });
    const measured = await prisma.measurement.findUnique({ where: { clientId: client.profileId } });

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
        clientProfileId: client.profileId,
        clientName: client.name,
        clientEmail: client.email,
        clientPhone: client.phone,
        ...(measured
          ? {
              measurementsSnapshot: snapshotFrom(measured) as Prisma.InputJsonValue,
              measurementsTakenAt: measured.updatedAt,
            }
          : {}),
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

type ResolvedClient =
  | { ok: true; profileId: string; name: string; email: string; phone: string | null }
  | { ok: false; status: number; error: string };

/**
 * Every commission made here lands in a client's file: the one picked from the
 * suggestions, else the client already on file with this email, else a new client
 * (no password, nothing mailed; no email → a placeholder that is never mailed).
 */
async function resolveCommissionClient(d: {
  clientUserId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}): Promise<ResolvedClient> {
  const typedName = d.clientName?.trim() || "";
  const typedEmail = d.clientEmail?.trim().toLowerCase() || "";
  const typedPhone = d.clientPhone?.trim() || null;
  const userSelect = { id: true, role: true, name: true, email: true, phone: true } as const;

  const existing = d.clientUserId
    ? await prisma.user.findUnique({ where: { id: d.clientUserId }, select: userSelect })
    : typedEmail
      ? await prisma.user.findFirst({ where: { email: { equals: typedEmail, mode: "insensitive" } }, select: userSelect })
      : null;

  if (d.clientUserId && !existing) return { ok: false, status: 404, error: "That client is no longer on file." };
  if (existing) {
    if (existing.role !== Role.CUSTOMER) {
      return { ok: false, status: 409, error: "This email belongs to a staff account, not a client." };
    }
    const profile = await getOrCreateClientProfile(existing.id);
    return {
      ok: true,
      profileId: profile.id,
      name: typedName || existing.name?.trim() || existing.email,
      email: existing.email.toLowerCase(),
      phone: typedPhone ?? existing.phone ?? null,
    };
  }

  const email = typedEmail || placeholderEmail(typedName);
  if (!typedEmail && !isUndeliverableAddress(email)) throw new Error("placeholder would be mailed");
  const profile = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name: typedName, phone: typedPhone, role: Role.CUSTOMER },
      select: { id: true },
    });
    return tx.clientProfile.create({ data: { userId: user.id }, select: { id: true } });
  });
  return { ok: true, profileId: profile.id, name: typedName, email, phone: typedPhone };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
