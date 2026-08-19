import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, CMS_ADMIN_PERMISSIONS } from "@/lib/admin-auth";
import { z } from "zod";

const patchSchema = z
  .object({
    isApproved: z.boolean().optional(),
    showOnHomepage: z.boolean().optional(),
    showOnConsultationPage: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.isApproved !== undefined ||
      d.showOnHomepage !== undefined ||
      d.showOnConsultationPage !== undefined,
    { message: "At least one field required" },
  );

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi(CMS_ADMIN_PERMISSIONS);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data: {
    isApproved?: boolean;
    showOnHomepage?: boolean;
    showOnConsultationPage?: boolean;
  } = {};
  if (parsed.data.isApproved !== undefined) data.isApproved = parsed.data.isApproved;
  if (parsed.data.showOnHomepage !== undefined) {
    if (parsed.data.showOnHomepage) {
      const existing = await prisma.review.findUnique({ where: { id }, select: { isApproved: true } });
      if (!existing?.isApproved) {
        return NextResponse.json({ error: "Only approved reviews can appear on the homepage" }, { status: 400 });
      }
    }
    data.showOnHomepage = parsed.data.showOnHomepage;
  }
  if (parsed.data.showOnConsultationPage !== undefined) {
    if (parsed.data.showOnConsultationPage) {
      const existing = await prisma.review.findUnique({
        where: { id },
        select: { isApproved: true, consultationId: true },
      });
      if (!existing?.isApproved) {
        return NextResponse.json(
          { error: "Only approved reviews can appear on the consultation page" },
          { status: 400 },
        );
      }
      if (!existing.consultationId) {
        return NextResponse.json({ error: "Not a consultation review" }, { status: 400 });
      }
    }
    data.showOnConsultationPage = parsed.data.showOnConsultationPage;
  }
  if (parsed.data.isApproved === false) {
    data.showOnHomepage = false;
    data.showOnConsultationPage = false;
  }

  const r = await prisma.review.update({ where: { id }, data });
  return NextResponse.json(r);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi(CMS_ADMIN_PERMISSIONS);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  await prisma.review.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
