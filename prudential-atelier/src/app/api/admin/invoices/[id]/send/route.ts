import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { sendInvoiceEmail } from "@/lib/email";
import { notifyInvoiceIssued } from "@/lib/customer-notifications";
import { formatInvoiceCurrency, getInvoiceSettings } from "@/lib/invoice";
import { getPublicAppUrl } from "@/lib/app-url";
import type { InvoiceCurrency } from "@/types/invoice";

function asCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP" || c === "EUR") return c;
  return "NGN";
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("invoices");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cur = asCurrency(inv.currency);
  const business = await getInvoiceSettings();
  const base = getPublicAppUrl().replace(/\/+$/, "");
  const publicLink = `${base}/invoice/${inv.publicToken}`;

  await sendInvoiceEmail({
    to: inv.clientEmail,
    clientName: inv.clientName,
    invoiceNumber: inv.invoiceNumber,
    total: formatInvoiceCurrency(inv.total, cur),
    currency: inv.currency,
    dueDate: inv.dueDate ? inv.dueDate.toLocaleDateString("en-GB") : undefined,
    depositRequired:
      inv.depositRequired > 0 ? formatInvoiceCurrency(inv.depositRequired, cur) : undefined,
    publicLink,
    clientNote: inv.clientNote ?? undefined,
    footerNote: business.footerNote || undefined,
    businessName: business.businessName,
  });

  await prisma.invoice.update({
    where: { id },
    data: {
      sentAt: inv.sentAt ?? new Date(),
      status: inv.status === InvoiceStatus.DRAFT ? InvoiceStatus.SENT : inv.status,
    },
  });

  notifyInvoiceIssued({
    clientEmail: inv.clientEmail,
    invoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    publicToken: inv.publicToken,
  });

  return NextResponse.json({ success: true });
}
