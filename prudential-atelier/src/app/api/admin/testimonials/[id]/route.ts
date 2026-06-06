import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, requireGeneralAdminApi } from "@/lib/admin-auth";
import { adminTestimonialBodySchema, toTestimonialWriteData } from "@/lib/admin-testimonial-schema";

const quickPatchSchema = z
  .object({
    isApproved: z.boolean().optional(),
    showOnHomepage: z.boolean().optional(),
  })
  .refine((d) => d.isApproved !== undefined || d.showOnHomepage !== undefined, {
    message: "At least one field required",
  });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.testimonial.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isFullUpdate =
    typeof body === "object" &&
    body !== null &&
    ("body" in body || "rating" in body || "userId" in body || "displayName" in body);

  if (isFullUpdate) {
    const generalGate = await requireGeneralAdminApi();
    if (!generalGate.ok) return generalGate.response;

    const parsed = adminTestimonialBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.userId) {
      const user = await prisma.user.findUnique({
        where: { id: parsed.data.userId },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
    }

    const updated = await prisma.testimonial.update({
      where: { id },
      data: toTestimonialWriteData(parsed.data),
    });
    return NextResponse.json(updated);
  }

  const parsed = quickPatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data: { isApproved?: boolean; showOnHomepage?: boolean } = {};
  if (parsed.data.isApproved !== undefined) data.isApproved = parsed.data.isApproved;
  if (parsed.data.showOnHomepage !== undefined) {
    const approved = parsed.data.isApproved ?? existing.isApproved;
    if (parsed.data.showOnHomepage && !approved) {
      return NextResponse.json({ error: "Only approved testimonials can appear on the homepage" }, { status: 400 });
    }
    data.showOnHomepage = parsed.data.showOnHomepage;
  }
  if (parsed.data.isApproved === false) {
    data.showOnHomepage = false;
  }

  const updated = await prisma.testimonial.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  await prisma.testimonial.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
