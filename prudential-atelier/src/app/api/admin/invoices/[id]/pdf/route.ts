import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { buildInvoicePdfModel } from "@/lib/invoice-pdf-data";
import { renderInvoicePdfBuffer } from "@/lib/render-invoice-pdf";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("invoices");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
