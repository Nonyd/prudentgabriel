import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { EMAIL_TEMPLATE_BY_KEY, type EmailTemplateKey } from "@/lib/admin-email-catalog";
import { patchEmailTemplate } from "@/lib/admin-email-template-store";

const patchSchema = z.object({
  subject: z.string().optional(),
  heading: z.string().optional(),
  body_1: z.string().optional(),
  body_2: z.string().optional(),
  cta_label: z.string().optional(),
  cta_link: z.string().optional(),
  footer_note: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const { key } = await params;
  if (!EMAIL_TEMPLATE_BY_KEY[key as EmailTemplateKey]) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const saved = await patchEmailTemplate(
    key as EmailTemplateKey,
    parsed.data,
    gate.session.user!.id!,
  );

  return NextResponse.json({ template: saved });
}
