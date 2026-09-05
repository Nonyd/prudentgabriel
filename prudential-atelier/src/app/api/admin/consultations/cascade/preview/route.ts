import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { ProductCascadeError } from "@/lib/product-cascade-delete";
import { previewConsultationCascade } from "@/lib/consultation-cascade-delete";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
});

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("consultations");
  if (!gate.ok) return gate.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Select at least one consultation" }, { status: 400 });
  }

  try {
    const preview = await previewConsultationCascade(parsed.data.ids);
    return NextResponse.json(preview);
  } catch (e) {
    if (e instanceof ProductCascadeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Could not preview delete" }, { status: 500 });
  }
}
