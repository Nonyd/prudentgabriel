import { NextRequest, NextResponse } from "next/server";
import { buildQuotationPdfModel } from "@/lib/quotation-pdf-data";
import { renderQuotationPdfBuffer } from "@/lib/render-quotation-pdf";
import { findQuotationByApprovalToken } from "@/lib/capability-token-lookup";
import { CAPABILITY_EXPIRED_COPY } from "@/lib/capability-token";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const found = await findQuotationByApprovalToken(token);
  if (!found.ok) {
    if (found.reason === "expired") {
      return NextResponse.json({ error: CAPABILITY_EXPIRED_COPY.body }, { status: 410 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const quote = found.quote;

  const model = await buildQuotationPdfModel(quote);
  const buf = await renderQuotationPdfBuffer(model);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.quoteRef.replace(/[^\w.-]+/g, "_")}.pdf"`,
    },
  });
}
