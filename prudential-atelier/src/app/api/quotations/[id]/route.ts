import { NextRequest, NextResponse } from "next/server";
import { Prisma, QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES, requireRoles } from "@/lib/api-auth";
import { logActivity, logError } from "@/lib/logger";
type Params = { params: Promise<{ id: string }> };

type QuoteLineItem = {
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

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(FINANCE_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const item = await prisma.quotation.findUnique({
      where: { id },
      include: { bespokeOrders: { select: { id: true, orderRef: true, status: true } } },
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_GET",
      message: e instanceof Error ? e.message : "Failed to fetch quotation",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(FINANCE_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status === QuoteStatus.CONVERTED) {
      return NextResponse.json({ error: "Converted quotations cannot be edited" }, { status: 400 });
    }

    const data: Prisma.QuotationUpdateInput = {};

    if (typeof body.clientName === "string") data.clientName = body.clientName.trim();
    if (typeof body.clientEmail === "string") data.clientEmail = body.clientEmail.trim().toLowerCase();
    if (typeof body.clientPhone === "string") data.clientPhone = body.clientPhone.trim() || null;
    if (typeof body.notes === "string") data.notes = body.notes;
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
    }

    let subtotal = existing.subtotal;
    let tax = existing.tax;
    let discount = existing.discount;

    if (body.lineItems !== undefined) {
      const lineItems = parseLineItems(body.lineItems);
      if (!lineItems) {
        return NextResponse.json({ error: "Invalid line items" }, { status: 400 });
      }
      data.lineItems = lineItems as unknown as Prisma.InputJsonValue;
      subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
    }
    if (typeof body.tax === "number") tax = body.tax;
    if (typeof body.discount === "number") discount = body.discount;

    data.subtotal = subtotal;
    data.tax = tax;
    data.discount = discount;
    data.total = Math.max(0, Math.round((subtotal + tax - discount) * 100) / 100);

    if (typeof body.status === "string" && (Object.values(QuoteStatus) as string[]).includes(body.status)) {
      data.status = body.status as QuoteStatus;
    }

    const item = await prisma.quotation.update({ where: { id }, data });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "UPDATE",
      module: "quotations",
      description: `Updated quotation ${item.quoteRef}`,
      recordId: item.id,
      recordType: "Quotation",
    });

    return NextResponse.json({ item });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_PATCH",
      message: e instanceof Error ? e.message : "Failed to update quotation",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(FINANCE_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status === QuoteStatus.CONVERTED) {
      return NextResponse.json({ error: "Converted quotations cannot be deleted" }, { status: 400 });
    }

    await prisma.quotation.delete({ where: { id } });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "DELETE",
      module: "quotations",
      description: `Deleted quotation ${existing.quoteRef}`,
      recordId: id,
      recordType: "Quotation",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_DELETE",
      message: e instanceof Error ? e.message : "Failed to delete quotation",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
