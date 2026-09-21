import { NextRequest, NextResponse } from "next/server";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { buildInvoicePdfModel } from "@/lib/invoice-pdf-data";
import { renderInvoicePdfBuffer } from "@/lib/render-invoice-pdf";
import { findInvoiceByPublicToken } from "@/lib/capability-token-lookup";
import { CAPABILITY_EXPIRED_COPY } from "@/lib/capability-token";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const limited = rateLimitOr429(req, "invoice-token-pdf", 20, 15 * 60 * 1000);
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

  const model = await buildInvoicePdfModel(inv);
  const buf = await renderInvoicePdfBuffer(model);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${inv.invoiceNumber.replace(/[^\w.-]+/g, "_")}.pdf"`,
    },
  });
}
