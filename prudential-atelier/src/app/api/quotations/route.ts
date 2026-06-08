import { NextRequest, NextResponse } from "next/server";
import { Prisma, QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES, requireRoles } from "@/lib/api-auth";
import { generateQuoteRef } from "@/lib/bespoke-stages";
import { logActivity, logError } from "@/lib/logger";

export type QuoteLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

function parseLineItems(raw: unknown): QuoteLineItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: QuoteLineItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const description = typeof r.description === "string" ? r.description.trim() : "";
    const quantity = typeof r.quantity === "number" ? r.quantity : Number(r.quantity);
    const unitPrice = typeof r.unitPrice === "number" ? r.unitPrice : Number(r.unitPrice);
    if (!description || !Number.isFinite(quantity) || quantity <= 0) return null;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
    const total =
      typeof r.total === "number" && Number.isFinite(r.total)
        ? r.total
        : Math.round(quantity * unitPrice * 100) / 100;
    items.push({ description, quantity, unitPrice, total });
  }
  return items.length > 0 ? items : null;
}

function calcTotals(items: QuoteLineItem[], tax = 0, discount = 0) {
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const total = Math.max(0, Math.round((subtotal + tax - discount) * 100) / 100);
  return { subtotal, total };
}

async function uniqueQuoteRef(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const quoteRef = generateQuoteRef();
    const exists = await prisma.quotation.findUnique({ where: { quoteRef } });
    if (!exists) return quoteRef;
  }
  return generateQuoteRef();
}

export async function GET(req: NextRequest) {
  const gate = await requireRoles(FINANCE_ROLES);
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();

    const where: Prisma.QuotationWhereInput = {};
    if (status && status !== "all" && (Object.values(QuoteStatus) as string[]).includes(status)) {
      where.status = status as QuoteStatus;
    }
    if (search) {
      where.OR = [
        { quoteRef: { contains: search, mode: "insensitive" } },
        { clientName: { contains: search, mode: "insensitive" } },
        { clientEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    const items = await prisma.quotation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ items });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_LIST",
      message: e instanceof Error ? e.message : "Failed to list quotations",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireRoles(FINANCE_ROLES);
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
  const clientEmail = typeof body.clientEmail === "string" ? body.clientEmail.trim().toLowerCase() : "";
  if (!clientName || !clientEmail) {
    return NextResponse.json({ error: "Client name and email are required" }, { status: 400 });
  }

  const lineItems = parseLineItems(body.lineItems);
  if (!lineItems) {
    return NextResponse.json({ error: "Valid line items are required" }, { status: 400 });
  }

  const tax = typeof body.tax === "number" ? body.tax : Number(body.tax) || 0;
  const discount = typeof body.discount === "number" ? body.discount : Number(body.discount) || 0;
  const { subtotal, total } = calcTotals(lineItems, tax, discount);

  const consultationId =
    typeof body.consultationId === "string" && body.consultationId.trim()
      ? body.consultationId.trim()
      : null;

  if (consultationId) {
    const consultation = await prisma.consultationBooking.findUnique({
      where: { id: consultationId },
      select: { id: true },
    });
    if (!consultation) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 400 });
    }
    const existing = await prisma.quotation.findFirst({
      where: { consultationId },
    });
    if (existing) {
      return NextResponse.json({ error: "A quotation is already linked to this consultation" }, { status: 409 });
    }
  }

  try {
    const quoteRef = await uniqueQuoteRef();
    const item = await prisma.quotation.create({
      data: {
        quoteRef,
        clientName,
        clientEmail,
        clientPhone: typeof body.clientPhone === "string" ? body.clientPhone.trim() || null : null,
        lineItems: lineItems as unknown as Prisma.InputJsonValue,
        subtotal,
        tax,
        discount,
        total,
        notes: typeof body.notes === "string" ? body.notes : null,
        expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null,
        consultationId,
        createdBy: gate.session.user.id,
      },
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "CREATE",
      module: "quotations",
      description: `Created quotation ${quoteRef}`,
      recordId: item.id,
      recordType: "Quotation",
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_CREATE",
      message: e instanceof Error ? e.message : "Failed to create quotation",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
