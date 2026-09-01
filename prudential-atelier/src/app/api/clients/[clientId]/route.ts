import { NextRequest, NextResponse } from "next/server";
import { LoyaltyTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BESPOKE_MANAGER_ROLES, BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";
import { logActivity, logError } from "@/lib/logger";
import { getClientPayments } from "@/lib/payments/ledger";

type Params = { params: Promise<{ clientId: string }> };

const TIERS = new Set<string>(Object.values(LoyaltyTier));

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { clientId } = await params;

  try {
    const item = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            orders: {
              orderBy: { createdAt: "desc" },
              take: 20,
              select: {
                id: true,
                orderNumber: true,
                status: true,
                total: true,
                createdAt: true,
              },
            },
            consultationBookings: {
              orderBy: { createdAt: "desc" },
              take: 20,
              select: {
                id: true,
                bookingNumber: true,
                status: true,
                confirmedDate: true,
                confirmedTime: true,
                createdAt: true,
              },
            },
          },
        },
        measurements: true,
        bespokeOrders: { orderBy: { createdAt: "desc" } },
        moodboards: { orderBy: { createdAt: "desc" } },
        adminNotes: { orderBy: { createdAt: "desc" } },
        eventDates: { orderBy: { date: "asc" } },
      },
    });

    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const payments = await getClientPayments({
      userId: item.userId,
      email: item.user.email,
    });

    return NextResponse.json({
      item: {
        ...item,
        payments: payments.map((p) => ({
          id: p.id,
          reference: p.reference,
          amount: Number(p.amount),
          currency: p.currency,
          purpose: p.purpose,
          status: p.status,
          createdAt: p.createdAt,
          confirmedAt: p.confirmedAt,
        })),
      },
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "CLIENT_GET",
      message: e instanceof Error ? e.message : "Failed to fetch client",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  // Loyalty points convert to money — manager tier, not floor STAFF.
  const gate = await requireRoles(BESPOKE_MANAGER_ROLES);
  if (!gate.ok) return gate.response;

  const { clientId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const existing = await prisma.clientProfile.findUnique({ where: { id: clientId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: {
      preferredSilhouettes?: string[];
      preferredColors?: string[];
      occasions?: string[];
      budgetRange?: string | null;
      loyaltyTier?: LoyaltyTier;
    } = {};

    if (Array.isArray(body.preferredSilhouettes)) {
      data.preferredSilhouettes = body.preferredSilhouettes.filter((v): v is string => typeof v === "string");
    }
    if (Array.isArray(body.preferredColors)) {
      data.preferredColors = body.preferredColors.filter((v): v is string => typeof v === "string");
    }
    if (Array.isArray(body.occasions)) {
      data.occasions = body.occasions.filter((v): v is string => typeof v === "string");
    }
    if (typeof body.budgetRange === "string") data.budgetRange = body.budgetRange.trim() || null;
    if (typeof body.loyaltyTier === "string" && TIERS.has(body.loyaltyTier)) {
      data.loyaltyTier = body.loyaltyTier as LoyaltyTier;
    }

    const item = await prisma.clientProfile.update({
      where: { id: clientId },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "UPDATE",
      module: "clients",
      description: `Updated client profile ${item.user.email}`,
      recordId: clientId,
      recordType: "ClientProfile",
    });

    return NextResponse.json({ item });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "CLIENT_PATCH",
      message: e instanceof Error ? e.message : "Failed to update client",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
