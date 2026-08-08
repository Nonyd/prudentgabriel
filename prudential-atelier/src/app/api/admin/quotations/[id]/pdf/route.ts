import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { buildQuotationPdfModel } from "@/lib/quotation-pdf-data";
import { renderQuotationPdfBuffer } from "@/lib/render-quotation-pdf";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const quote = await prisma.quotation.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const model = await buildQuotationPdfModel(quote);
  const buf = await renderQuotationPdfBuffer(model);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.quoteRef.replace(/[^\w.-]+/g, "_")}.pdf"`,
    },
  });
}
