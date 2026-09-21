import { NextResponse } from "next/server";
import { sendInvoiceEmail } from "@/lib/email";
import { formatInvoiceCurrency, getInvoiceSettings } from "@/lib/invoice";
import { getPublicAppUrl } from "@/lib/app-url";
import { rateLimitOr429 } from "@/lib/rate-limit";
import type { InvoiceCurrency } from "@/types/invoice";
import {
  ensureInvoicePublicRaw,
  findInvoiceByPublicToken,
} from "@/lib/capability-token-lookup";
import { CAPABILITY_EXPIRED_COPY } from "@/lib/capability-token";

function asCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP" || c === "EUR") return c;
  return "NGN";
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const limited = rateLimitOr429(req, "invoice-email-copy", 5, 15 * 60 * 1000);
  if (limited) return limited;

  const { token } = await ctx.params;

  const found = await findInvoiceByPublicToken(token);
  if (!found.ok) {
    if (found.reason === "expired") {
      return NextResponse.json({ error: CAPABILITY_EXPIRED_COPY.body }, { status: 410 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const inv = found.inv;

  const cur = asCurrency(inv.currency);
  const business = await getInvoiceSettings();
  const base = getPublicAppUrl().replace(/\/+$/, "");
  const raw = await ensureInvoicePublicRaw(inv);
  const publicLink = `${base}/invoice/${raw}`;

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
