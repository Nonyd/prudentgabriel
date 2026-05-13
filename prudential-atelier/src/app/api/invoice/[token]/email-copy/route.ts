import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail } from "@/lib/email";
import { formatInvoiceCurrency, getInvoiceSettings } from "@/lib/invoice";
import { getPublicAppUrl } from "@/lib/app-url";
import type { InvoiceCurrency } from "@/types/invoice";

function asCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP") return c;
  return "NGN";
}

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const inv = await prisma.invoice.findUnique({ where: { publicToken: token } });
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

  return NextResponse.json({ success: true });
}
