import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { reviseQuotation } from "@/lib/quotation-versioning";
import { logError } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi("quotations");
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const item = await reviseQuotation({
      quotationId: id,
      actor: {
        id: gate.session.user.id!,
        email: gate.session.user.email,
        role: gate.session.user.role,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "SUPERSEDED") {
      return NextResponse.json(
        { error: "This quotation was superseded. Open the latest version to revise." },
        { status: 400 },
      );
    }
    if (code === "CONVERTED") {
      return NextResponse.json(
        {
          error:
            "This quotation was converted to an invoice/order. Revisions require a credit note, not an edit.",
        },
        { status: 400 },
      );
    }
    if (code === "DRAFT_EDIT") {
      return NextResponse.json(
        { error: "Unsent drafts can be edited in place — revise is only for sent quotations." },
        { status: 400 },
      );
    }
    await logError({
      severity: "WARNING",
      errorType: "QUOTATION_REVISE",
      message: e instanceof Error ? e.message : "Failed to revise quotation",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
